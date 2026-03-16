const admin = require('firebase-admin');

async function getMap(req, res, sodium, logger) {
  // check header
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith('Bearer ')
  ) {
    logger.info('Unauthorized: no headers');
    return res.status(403).send('Unauthorized').end();
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
    const map = {};
    try {
      const snapshot = await admin
        .database()
        .ref('/patientsMapping/vascular')
        .once('value');
      if (snapshot.exists) {
        const m = snapshot.val();
        map.datetime = m.dateTime;
        map.name = m.name;
	const los = m.specialtyAverageLOS;
        map.averageLOS = los.toString();
	const nop = m.specialtyNumberOfPatients;
        map.numberOfPts = nop.toString();
        map.items = [];
        let txt = '';
        if (m.children) {
          for (let i = 0; i < m.children.length; i += 1) {
            txt = `\n** ${m.children[i].name} - ${m.children[i].wardNumberOfPatients} pcts **`;
            map.items.push(txt);
            if (m.children[i].children) {
              for (let j = 0; j < m.children[i].children.length; j += 1) {
	       const reg = m.children[i].children[j].children[0].children[1].name;
		const [_, r] = reg.split(' ');
                txt = `${m.children[i].children[j].name} - R. ${r}`;
                map.items.push(txt);
              }
            }
          }
        }
        return res.send(JSON.stringify(map)).end();
      }
      throw new Error('did not find patient on local db');
    } catch (e) {
      logger.error(e);
      return res.status(500).end();
    }
  }
  logger.info('Unauthorized');
  return res.status(403).send('Unauthorized').end();
}

exports.getMap = getMap;
