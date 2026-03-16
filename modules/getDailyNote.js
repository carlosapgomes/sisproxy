const admin = require('firebase-admin');

async function getDailyNote(req, res, pgClient, sodium, logger) {
  // check header
  if (
    !req.headers.authorization
    || !req.headers.authorization.startsWith('Bearer ')
  ) {
    logger.info('Unauthorized: no headers');
    return res.status(403).send('Unauthorized').end();
  }
  // check parameter
  if (typeof req.body === 'undefined') {
    return res.status(400).end();
  }
  const searchParams = req.body;
  // check for empty params
  if (
    typeof searchParams.searchString === 'undefined'
    || searchParams.searchString === ''
  ) {
    return res.send([]).end();
  }
  // Grab and verify Token
  const tokenHex = req.headers.authorization.split('Bearer ')[1];
  const token = sodium.from_hex(tokenHex);
  // decrypt token and verify its msg
  const nonceBytes = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const key = process.env.SYMM_KEY;
  const nonce = token.slice(0, nonceBytes);
  const ciphertext = token.slice(nonceBytes);
  let jsonToken;
  try {
    const decryptedStr = sodium.crypto_secretbox_open_easy(
      ciphertext,
      nonce,
      key,
    );
    jsonToken = JSON.parse(sodium.to_string(decryptedStr));
  } catch (e) {
    logger.info("error decrypting token");
    logger.error(e);
    return res.status(400).end();
  }
  // at this point we have a json that has a
  // - matrix user id
  // - timestamp
  // - exp
  // check if token is valid
  // timestamp must be <= now AND
  // timestamp + exp must be >= now
  let now = Date.now();
  now = Math.trunc(now / 1000);
  if (
    jsonToken.timestamp <= now
    && jsonToken.timestamp + jsonToken.exp >= now
  ) {
    let dailyNote = {};
    // call postgres node using pgClient
    const values = [];
    values.push(searchParams.searchString);
    const q = 'SELECT id,pct_name,pct_rec_n,bed,ward_name FROM pcts WHERE pct_rec_n=$1 limit 1';
    try {
      const result = await pgClient.query(q, values);
      if (result.rows.length > 0) {
        dailyNote["patientID"] = result.rows[0].id;
        dailyNote["patientRecN"] = result.rows[0].pct_rec_n;
        dailyNote["bed"] = result.rows[0].bed;
        dailyNote["ward"] = result.rows[0].ward_name;
        dailyNote["patientName"] = result.rows[0].pct_name;
        const snapshot1 = await admin.database().ref(`patients/${dailyNote.patientID}`)
          .once('value');
        if (snapshot1.exists) {
          const patient = snapshot1.toJSON();
          if (typeof patient.currentdailynotekey === 'undefined') {
            throw new Error('this patient do not have a daily note');
          }
          const snapshot2 = await admin.database()
            .ref(`dailynotes/${patient.currentdailynotekey}`)
            .once('value');
          if (snapshot2.exists) {
            const dn = snapshot2.toJSON();
            dailyNote["datetime"] = dn.datetime;
            dailyNote["userName"] = dn.username;
            dailyNote["assessplan"] = dn.content.assessplan;
            dailyNote["examsList"] = dn.content.examsList;
            dailyNote["objective"] = dn.content.objective;
            dailyNote["pendency"] = dn.content.pendency;
            dailyNote["problemsList"] = dn.content.problemsList;
            dailyNote["shortHistory"] = dn.content.shortHistory;
            dailyNote["subjective"]  = dn.content.subjective;
            return res.send(JSON.stringify(dailyNote)).end();
          } else {
            throw new Error('did not find daily note');
          }
        } else {
          throw new Error('did not find patient on firebase');
        }
      } else {
        throw new Error('did not find patient on local db');
      }
    } catch (e) {
      logger.error(e);
      return res.status(500).end();
    }

    // then((result) => res.send(result.rows).end())
  }
  logger.info('Unauthorized');
  return res.status(403).send('Unauthorized').end();
}

exports.getDailyNote = getDailyNote;
