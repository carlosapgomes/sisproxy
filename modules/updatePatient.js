/**
 * Created by carlos on 22/07/2017.
 */
function patientUpdate(req, res, jwt, esJwtSymmetricKey, pgClient, logger) {
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
  if (esJwtSymmetricKey === null) {
    logger.info("no jwt key");
    return res
      .status(500)
      .send("error")
      .end();
  }
  var patient = req.body;
  // Grab and verify idToken
  const jwtToken = req.headers.authorization.split("Bearer ")[1];
  if (jwtToken) {
    // verifies secret and checks exp
    return jwt.verify(jwtToken, esJwtSymmetricKey.secret, function(
      err,
      decoded
    ) {
      if (err) {
        logger.error(err);
        logger.info("error verifying jwt token");
        return res
          .status(500)
          .send("error")
          .end();
      } else {
        // jwtToken is valid
        // remove patient from ES node
        var patientKey = req.params.patientKey;
        logger.info("Updating patient: " + patient.name);
        logger.info("patientKey: " + patientKey);

        const q =
          "UPDATE pcts SET pct_name=$2, pct_rec_n=$3, bed=$4, ward_name=$5, ward_key=$6, pct_status=$7, specialties_keys=ARRAY[$8], specialties_names=ARRAY [$9], pct_vectors = (to_tsvector($10) || to_tsvector('Portuguese', $11)) WHERE id=$1";
        const values = [
          patientKey,
          patient.name,
          patient.ptRecN,
          patient.bed,
          patient.ward,
          patient.wardKey,
          patient.status,
          patient.specialtiesKeys,
          patient.specialtiesNames,
          patient.ptRecN,
          patient.name
        ];

        return pgClient
          .query(q, values)
          .then(result => {
            return res.send(result).end();
          })
          .catch(e => {
            logger.error(e);
            console.trace(e.message);
            return res
              .status(500)
              .send("error")
              .end();
          });
      }
    });
  } else {
    logger.info("no token");
    return res
      .status(500)
      .send("error")
      .end();
  }
}

exports.patientUpdate = patientUpdate;
