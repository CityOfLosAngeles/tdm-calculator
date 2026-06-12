const crypto = require("crypto");
const { SAML } = require("@node-saml/node-saml");

const PROVIDER = "google";
const DEFAULT_SP_ENTITY_ID = "/google-saml";
const EMAIL_NAME_ID_FORMAT =
  "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

const isEnabled = () =>
  String(process.env.GOOGLE_SSO_PROTOCOL || "oauth").toLowerCase() === "saml";

const normalizeCertificate = certificate =>
  String(certificate || "")
    .replace(/\\n/g, "\n")
    .trim();

const getServerUrl = () => (process.env.SERVER_URL || "").replace(/\/$/, "");

const getConfig = () => {
  const serverUrl = getServerUrl();
  const spEntityId =
    process.env.GOOGLE_SAML_SP_ENTITY_ID ||
    (serverUrl ? `${serverUrl}${DEFAULT_SP_ENTITY_ID}` : "");
  const acsUrl =
    process.env.GOOGLE_SAML_ACS_URL ||
    (serverUrl ? `${serverUrl}/api/accounts/google/saml/acs` : "");

  return {
    entryPoint: process.env.GOOGLE_SAML_IDP_SSO_URL,
    idpEntityId: process.env.GOOGLE_SAML_IDP_ENTITY_ID,
    idpCert: normalizeCertificate(process.env.GOOGLE_SAML_IDP_CERT),
    spEntityId,
    acsUrl,
    acceptedClockSkewMs: Number(process.env.GOOGLE_SAML_CLOCK_SKEW_MS || 5000)
  };
};

const assertConfigured = config => {
  const missing = [];
  if (!config.entryPoint) missing.push("GOOGLE_SAML_IDP_SSO_URL");
  if (!config.idpCert) missing.push("GOOGLE_SAML_IDP_CERT");
  if (!config.spEntityId) missing.push("GOOGLE_SAML_SP_ENTITY_ID");
  if (!config.acsUrl) missing.push("GOOGLE_SAML_ACS_URL");

  if (missing.length > 0) {
    const err = new Error(
      `Google SAML is not configured: ${missing.join(", ")}`
    );
    err.code = "GOOGLE_SAML_NOT_CONFIGURED";
    throw err;
  }
};

const createClient = config =>
  new SAML({
    acceptedClockSkewMs: config.acceptedClockSkewMs,
    audience: config.spEntityId,
    callbackUrl: config.acsUrl,
    disableRequestedAuthnContext: true,
    entryPoint: config.entryPoint,
    identifierFormat: EMAIL_NAME_ID_FORMAT,
    idpCert: config.idpCert,
    idpIssuer: config.idpEntityId,
    issuer: config.spEntityId
  });

const sanitizeRedirectPath = redirectPath => {
  if (!redirectPath || typeof redirectPath !== "string") return "/";
  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return "/";
  }
  return redirectPath;
};

const encodeStateCookie = state =>
  Buffer.from(JSON.stringify(state), "utf8").toString("base64url");

const decodeStateCookie = value => {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const createLoginRequest = async redirectPath => {
  const config = getConfig();
  assertConfigured(config);
  const state = {
    redirectPath: sanitizeRedirectPath(redirectPath),
    state: crypto.randomBytes(32).toString("hex")
  };
  const client = createClient(config);
  const authorizationUrl = await client.getAuthorizeUrlAsync(state.state);

  return { authorizationUrl, state };
};

const validateResponse = async body => {
  const config = getConfig();
  assertConfigured(config);
  const client = createClient(config);
  const result = await client.validatePostResponseAsync({
    SAMLResponse: body.SAMLResponse
  });

  if (!result.profile) {
    throw new Error("Google SAML response did not include a user profile");
  }

  return result.profile;
};

const getFirstValue = (...values) => {
  const value = values.find(item => {
    if (Array.isArray(item)) return item.length > 0 && item[0];
    return item !== undefined && item !== null && item !== "";
  });

  if (Array.isArray(value)) return value[0];
  return value;
};

const getUserProfile = profile => {
  const email = getFirstValue(
    profile.email,
    profile.mail,
    profile.emailAddress,
    profile["urn:oid:0.9.2342.19200300.100.1.3"],
    profile.nameID
  );

  if (!email) {
    throw new Error("Google SAML response is missing email");
  }

  const firstName = getFirstValue(
    profile.firstName,
    profile.givenName,
    profile.given_name,
    profile["First Name"],
    profile["urn:oid:2.5.4.42"],
    "Google"
  );
  const lastName = getFirstValue(
    profile.lastName,
    profile.sn,
    profile.surname,
    profile.familyName,
    profile.family_name,
    profile["Last Name"],
    profile["urn:oid:2.5.4.4"],
    "User"
  );

  return {
    externalAuthProvider: PROVIDER,
    externalSubject: String(profile.nameID || email),
    email: String(email),
    firstName: String(firstName).slice(0, 50),
    lastName: String(lastName).slice(0, 50)
  };
};

module.exports = {
  createLoginRequest,
  decodeStateCookie,
  encodeStateCookie,
  getUserProfile,
  isEnabled,
  validateResponse
};
