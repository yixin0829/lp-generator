import React from "react";
import Cat from "../../assets/cat.png";
import Seo from "../../seo/Seo";

const Page404 = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "90vh",
        minHeight: "500px",
      }}
    >
      <Seo title="Page Not Found" noindex />
      <img src={Cat} className="full-img" alt="" />
      <h2 className="bad-request">Page not found.</h2>
    </div>
  );
};

export { Page404 };
