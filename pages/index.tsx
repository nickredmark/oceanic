import { useRef } from "react";

export default () => {
  const ref = useRef(null);
  return (
    <form
      style={{
        display: "flex",
        height: "100vh",
        alignContent: "middle"
      }}
      onSubmit={e => {
        try {
          e.preventDefault();
          const url = new URL(ref.current.value);
          const urlParams = new URLSearchParams(url.search);
          const id = urlParams.get("v");
          if (!id) {
            throw new Error("Couldn't parse url");
          }
          window.location.href = `/view/${id}`;
        } catch (e) {
          alert(e.message);
        }
      }}
    >
      <input
        style={{
          width: "100%",
          maxWidth: "500px",
          margin: "auto"
        }}
        ref={ref}
        placeholder="Youtube video, e.g. https://www.youtube.com/watch?v=9Edkw-PC_jI"
      />
    </form>
  );
};
