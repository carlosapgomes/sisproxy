/**
 * Created by carlos on 11/03/2017.
 */
// main firebase dependencies
const admin = require('firebase-admin');
const atob = require('atob');
// helper libraries
function getAuthToken(req,res) {
  console.log('getAuthToken called');
  // Grab the text parameter.
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    res.status(403).send('Unauthorized').end();
    return console.log('no headers');
  }
  //   if(typeof req.query.token === 'undefined'){
  //   return res.status(400).end();
  // }
  const idToken = req.headers.authorization.split('Bearer ')[1];
  // const idToken = req.query.token;
  //  res.setHeader('Access-Control-Allow-Origin','http://localhost:5000');
  return admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    const uid = decodedIdToken.uid;
    console.log('User Name:' +  decodedIdToken.name);    
    console.log('UserId: ' + uid + ' (token verified)');
    return admin.database().ref('/users/'+uid).once('value', function (snapshot) {
      console.log('got user data');
      if(!snapshot.exists()){
        console.log('user unknown');        
        return res.status(200).json({user: "unknown"}).end();
      }else{
        // if snapshot exists, it means that this user has already been registered
        // explicitly verify each relevant condition and add a catch all clause at the end
        var user = snapshot.val();
        if(!user.verified){
          console.log('user not_verified');        
          return res.status(200).json({user: "not_verified"}).end();
        }
        if((user.verified) && (!user.authorized)){
          console.log('user not_authorized');        
          return res.status(200).json({user: "not_authorized"}).end();
        }
        if ((user.registered) &&
            (user.verified) &&
            (user.authorized)){
          //create auth token
          var additionalClaims = {
            registered: true,
            verified: true,
            authorized:true
          };
          if(user.admin){
            additionalClaims.admin = true;
          }
          if(user.medicallicencenumber){
            additionalClaims.medicallicencenumber = user.medicallicencenumber;
          }
          if(user.individualregistrationdocnumber){
            additionalClaims.individualregistrationdocnumber = user.individualregistrationdocnumber;
          }
          return admin.auth().createCustomToken(uid,additionalClaims)
            .then((customToken)=> {
              // Send token back to client
              console.log('authToken sent');
              return res.status(200).json({token: customToken}).end();
            }).catch((error) =>{
              console.log(error);
              console.log('could not create custom token');
              return res.status(403).send();
            });
        }else{
          // catch all other conditions
          // if execution reaches this point, it means that current
          // user has not enough rights to access the system 
          console.log('catch all: user not_authorized');        
          return res.status(200).json({user: "not_authorized"}).end();
        }
      }
    }).catch(error => {
      console.log(error);
      console.log('could not find user in database');
      return res.status(403).send('Unauthorized');
    });
  }).catch(error => {
    console.log(error);
    console.log(idToken);
    //decode token
    var segments = idToken.split(".");
    if (!(segments instanceof Array) || (segments.length !== 3)) {
      console.log('could not decode idToken');
    }
    var claims = segments[1];
    var decodedToken =JSON.parse(decodeURIComponent(escape(atob(claims))));
    console.log('Decoded Token:\n' + decodedToken);
    return res.status(403).send();
  });
}
exports.getAuthToken = getAuthToken;
