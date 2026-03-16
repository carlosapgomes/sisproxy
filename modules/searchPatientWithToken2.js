/**
 * Created by carlos on 24/01/2021.
 */
function searchPatientWithToken(req, res, pgClient, sodium, logger) {
  const searchParams = req.body;
  // check header
  if (
    !req.headers.authorization
    || !req.headers.authorization.startsWith('Bearer ')
  ) {
    logger.info('Unauthorized no headers');
    return res
      .status(403)
      .send('Unauthorized')
      .end();
  }
  // check parameter
  if (typeof req.body === 'undefined') {
    return res.status(400).end();
  }
  // check for empty params
  if ((typeof searchParams.searchString === 'undefined')
    || (searchParams.searchString === '')) {
    return res.send([]).end();
  }
  // Grab and verify idToken
  logger.info(req.headers.authorization);
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
  if ((jsonToken.timestamp <= now)
    && ((jsonToken.timestamp + jsonToken.exp) >= now)) {
    // call postgres node using pgClient
    const values = [];
    values.push(searchParams.searchString);
    const q = "SELECT * , ts_rank_cd(pct_vectors, query) AS rank FROM pcts, websearch_to_tsquery('Portuguese', $1) query  WHERE query @@ pct_vectors AND pct_status='inpatient' order by rank DESC";
    return pgClient
      .query(q, values)
      .then((result) => res.send(result.rows).end())
      .catch((e) => {
        logger.error(e);
        return res.status(500).end();
      });
  }
  logger.info('Unauthorized');
  return res
    .status(403)
    .send('Unauthorized')
    .end();
}

exports.searchPatientWithToken = searchPatientWithToken;
