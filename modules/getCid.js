/**
 * Created by carlos on 17/07/2017.
 */
// main firebase dependencies
const admin = require("firebase-admin");
// helper libraries
function getCid(req, res, esClient, logger) {
  //check header
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer ")
  ) {
    res
      .status(403)
      .send("Unauthorized")
      .end();
    return logger.info("no headers");
  }
  //check parameter
  if (typeof req.query.text === "undefined") {
    return res.status(400).end();
  }

  //check for empty text string
  if (req.query.text === "") {
    return res.send([]).end();
  }
  // Grab and verify idToken
  const idToken = req.headers.authorization.split("Bearer ")[1];
  return admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedIdToken => {
      const uid = decodedIdToken.uid;
      if (
        decodedIdToken.registered &&
        decodedIdToken.verified &&
        decodedIdToken.authorized
      ) {
        // call elasticsearch node using esClient
        // format a query and send it as a json in the request's body
        // consider a match_query or a simple_query
        var queryText = req.query.text + "*";
        // var queryBody = {
        //   "query": {
        //     "match" : {
        //       "_all" : queryText
        //     }
        //   }
        // };
        var queryBody = {
          query: {
            simple_query_string: {
              query: queryText,
              default_operator: "and",
              fields: ["cid", "descr", "descrabrev", "id", "chaves"]
            }
          }
        };
        return esClient
          .search({
            index: "sisp",
            type: "cid",
            body: queryBody
          })
          .then(resp => {
            var hits = resp.hits.hits;
            return res.send(hits).end();
          })
          .catch(e => {
            logger.error(e);
            console.trace(e.message);
            return res.status(500).end();
          });
      } else {
        logger.info("user is not authorized");
        return res
          .status(403)
          .send("Unauthorized")
          .end();
      }
    })
    .catch(e => {
      logger.error(e);
      return res.status(500).end();
    });
}
exports.getCid = getCid;
