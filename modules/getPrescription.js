const admin = require('firebase-admin');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)
async function getPrescription(req, res, pgClient, sodium, logger) {
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
    const prescription = {};
    // call postgres node using pgClient
    const values = [];
    values.push(searchParams.searchString);
    const q = 'SELECT id,pct_name,pct_rec_n,bed,ward_name FROM pcts WHERE pct_rec_n=$1 limit 1';
    try {
      const result = await pgClient.query(q, values);
      if (result.rows.length > 0) {
        prescription.patientID = result.rows[0].id;
        prescription.patientRecN = result.rows[0].pct_rec_n;
        prescription.bed = result.rows[0].bed;
        prescription.ward = result.rows[0].ward_name;
        prescription.patientName = result.rows[0].pct_name;
        const snapshot1 = await admin.database()
          .ref(`patients/${prescription.patientID}`)
          .once('value');
        if (snapshot1.exists) {
          const patient = snapshot1.toJSON();
          if (typeof patient.currentprescriptionkey === 'undefined') {
            throw new Error('this patient does not have a prescription');
          }
          const snapshot2 = await admin.database()
            .ref(`prescriptions/${patient.currentprescriptionkey}`)
            .once('value');
          if (snapshot2.exists) {
            const prescr = snapshot2.val();
            prescription.datetime = prescr.datetime;
            prescription.userName = prescr.username;
            prescription.items = [];
            for (let i = 0; i < prescr.content.length; i += 1) {
              let text = '';
              const ord = i + 1;
              if (prescr.content[i].initdate) {
		const init = dayjs(prescr.content[i].initdate, "DD/MM/YYYY");
		const endDate = dayjs(prescr.datetime);
		var delta = endDate.diff(init, 'day');
                //const init = dayjs(prescr.content[i].initdate, 'DD/MM/YYYY');
                //let delta = dayjs(prescr.datetime).diff(init, 'days');
                delta += 1;
                text = `${ord}) ${prescr.content[i].name} ${prescr.content[i].descr} ${prescr.content[i].dose} ${prescr.content[i].via} ${prescr.content[i].freq} (D ${delta} - Di: ${prescr.content[i].initdate})`;
              } else {
                text = `${ord}) ${prescr.content[i].name} ${prescr.content[i].descr} ${prescr.content[i].dose} ${prescr.content[i].via} ${prescr.content[i].freq}`;
              }
              prescription.items.push(text);
            }
            return res.send(JSON.stringify(prescription)).end();
          } 
            throw new Error('did not find prescription');
          
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
  }
  logger.info('Unauthorized');
  return res.status(403).send('Unauthorized').end();
}

exports.getPrescription = getPrescription;

