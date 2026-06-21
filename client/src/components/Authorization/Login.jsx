import React, { useEffect, useState, useContext } from "react";
import UserContext from "../../contexts/UserContext";
import { useNavigate, useLocation } from "react-router-dom";
import { createUseStyles, useTheme } from "react-jss";
import * as accountService from "../../services/account.service";
import Button from "../Button/Button";
import ContentContainer from "../Layout/ContentContainer";
import angelenoAccountButton from "../../images/angeleno-account-button-light.svg";

const useStyles = createUseStyles(theme => ({
  warningText: {
    ...theme.typography.paragraph1,
    color: theme.colorCritical,
    textAlign: "center"
  },
  ssoButtonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    justifyContent: "center",
    margin: "16px auto"
  },
  angelenoAccountSignIn: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  angelenoAccountButton: {
    background: "transparent",
    border: 0,
    cursor: "pointer",
    minHeight: "46px",
    minWidth: "258px",
    padding: 0,
    width: "258px"
  },
  angelenoAccountButtonImage: {
    display: "block",
    height: "auto",
    width: "258px"
  },
  angelenoAccountTagline: {
    ...theme.typography.paragraph1,
    margin: 0,
    textAlign: "center"
  }
}));

const Login = () => {
  const userContext = useContext(UserContext);
  const { search } = useLocation();
  const searchParams = new URLSearchParams(search);
  const projectId = searchParams.get("projectId");
  const redirectUrl = searchParams.get("url");
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");
  const classes = useStyles();
  const theme = useTheme();

  const getPostLoginPath = () => {
    if (projectId) return `/calculation/5/${projectId}`;
    if (redirectUrl) return `/${redirectUrl}`;
    return "/calculation/1/0";
  };

  useEffect(() => {
    const completeSsoLogin = async () => {
      if (
        searchParams.get("angeleno") !== "success" &&
        searchParams.get("google") !== "success"
      ) {
        return;
      }

      const sessionResponse = await accountService.getSession();
      if (sessionResponse?.isSuccess) {
        userContext.updateAccount(sessionResponse.user);
        navigate(searchParams.get("next") || getPostLoginPath());
      } else {
        setErrorMsg(
          "SSO sign-in succeeded, but the TDM session could not be loaded."
        );
      }
    };

    completeSsoLogin();
  }, []);

  const handleAngelenoLogin = () => {
    accountService.startAngelenoLogin(getPostLoginPath());
  };

  const handleGoogleLogin = () => {
    accountService.startGoogleLogin(getPostLoginPath());
  };

  return (
    <ContentContainer>
      <div style={theme.typography.heading1}>
        <span>Welcome to Los Angeles&rsquo; TDM Calculator</span>
      </div>
      <div style={theme.typography.subHeading}>
        <span>Please sign into your account to save progress</span>
      </div>
      <br />
      <div className="auth-form">
        <div className={classes.ssoButtonContainer}>
          <Button
            id="cy-login-google"
            type="button"
            variant="primary"
            onClick={handleGoogleLogin}
          >
            Sign in with Google SSO (City staff)
          </Button>
          <div className={classes.angelenoAccountSignIn}>
            <button
              aria-label="Sign in with Angeleno Account"
              className={classes.angelenoAccountButton}
              id="cy-login-angeleno"
              type="button"
              onClick={handleAngelenoLogin}
            >
              <img
                alt="Sign in with Angeleno Account"
                className={classes.angelenoAccountButtonImage}
                src={angelenoAccountButton}
              />
            </button>
            <p className={classes.angelenoAccountTagline}>
              Your one account to access City of Los Angeles services.
            </p>
          </div>
        </div>
        <p className={classes.warningText}>{errorMsg}</p>
      </div>
    </ContentContainer>
  );
};

export default Login;
