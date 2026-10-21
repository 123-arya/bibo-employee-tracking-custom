import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "https://auth.hawkaerosystem.com",
  realm: "aerosystem",
  clientId: "bibo",
});

export default keycloak;
