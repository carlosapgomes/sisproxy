/**
 * Created by carlos on 25/07/2017.
 */
// main firebase dependencies
const admin = require('firebase-admin');
// helper libraries
function searchPatient(req, res, pgClient, logger) {
  // check header
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith('Bearer ')
  ) {
    return res
      .status(403)
      .send('Unauthorized')
      .end();
  }
  // check parameter
  if (typeof req.body === 'undefined') {
    return res.status(400).end();
  }
  const searchParams = req.body;
  // check for empty params
  // if (
  //   (typeof searchParams.name === "undefined" &&
  //     typeof searchParams.ptRecN === "undefined") ||
  //   (searchParams.name === "" && searchParams.ptRecN === "")
  // ) {
  //   logger.info("missing name and ptRecN params");
  //   return res.send([]).end();
  // }

  if (
    typeof searchParams.searchString === 'undefined'
    || searchParams.searchString === ''
  ) {
    logger.info('missing name and ptRecN params');
    return res.send([]).end();
  }
  // Grab and verify idToken
  const idToken = req.headers.authorization.split('Bearer ')[1];
  return admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedIdToken) => {
      const { uid } = decodedIdToken;
      if (
        decodedIdToken.registered
        && decodedIdToken.verified
        && decodedIdToken.authorized
      ) {
        // call postgres node using pgClient
        const text = searchParams.searchString;
        const values = [];
        // if (typeof searchParams.name !== "undefined") {
        //   text = searchParams.name;
        // } else if (typeof searchParams.ptRecN !== "undefined") {
        //   text = searchParams.ptRecN;
        // }
        values.push(text);
        let q;
        if (searchParams.status) {
          q =
            "SELECT * , ts_rank_cd(pct_vectors, query) AS rank FROM pcts, websearch_to_tsquery('Portuguese', $1) query  WHERE query @@ pct_vectors AND pct_status=$2 order by rank DESC";
          values.push(searchParams.status);
        } else {
          q =
            "SELECT * , ts_rank_cd(pct_vectors, query) AS rank FROM pcts, websearch_to_tsquery('Portuguese', $1) query  WHERE query @@ pct_vectors order by rank DESC";
        }
        // logger.info(JSON.stringify(q));
        return pgClient
          .query(q, values)
          .then((result) => res.send(result.rows).end())
          .catch((e) => {
            logger.error(e);
            // console.trace(e.message);
            return res.status(500).end();
          });
      }
      logger.info(`user: ${uid} is not authorized`);
      return res
        .status(403)
        .send('Unauthorized')
        .end();
    })
    .catch((e) => {
      logger.error(e);
      return res.status(500).end();
    });
}
exports.searchPatient = searchPatient;
