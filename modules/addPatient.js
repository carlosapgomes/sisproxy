/**
 * Created by carlos on 30/07/2017.
 */
function addPatient(req, res, jwt, esJwtSymmetricKey, pgClient, logger) {
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
      _decoded
    ) {
      if (err) {
        logger.error(err);
        return res
          .status(500)
          .send("error")
          .end();
      } else {
        // jwtToken is valid
        var patientKey = req.params.patientKey;
        logger.info("Adding new patient to pg:");
        logger.info("Key: " + patientKey);
        logger.info("Name: " + patient.name);
        logger.info("RecNumber: " + patient.ptRecN);
        const q =
          "INSERT INTO pcts (id, pct_name, pct_rec_n, bed, ward_name, ward_key, pct_status, specialties_keys, specialties_names, pct_vectors) VALUES ($1, $2, $3, $4, $5, $6, $7, ARRAY[$8], ARRAY [$9], (to_tsvector($10) || to_tsvector('Portuguese', $11)))";
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

exports.addPatient = addPatient;
