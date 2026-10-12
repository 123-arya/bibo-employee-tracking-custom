import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "https://keycloak.hawkaerosystem.com",
  realm: "bibo",
  clientId: "bibo",
});

export default keycloak;
