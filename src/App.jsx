import { GoogleLogin } from "@react-oauth/google";
import { useRef, useState, useMemo } from "react";
import OpenAI from "openai";

const PROJECT_ID = import.meta.env.VITE_SERVERLESSAI_PROJECT_ID;

function Recognizer({ credential }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [result, setResult] = useState("");
  // One of: IDLE, CAPTURING, RECOGNIZING
  const [state, setState] = useState("IDLE");

  const openai = useMemo(
    () =>
      new OpenAI({
        baseURL: "https://openai.api.serverlessai.dev/v1",
        apiKey: `${PROJECT_ID}:${credential}`,
        // Normally, it would be a terrible idea to use OpenAI client in browser because it exposes your API key to the world.
        // But ServerlessAI allows you to do it safely!
        dangerouslyAllowBrowser: true,
      }),
    []
  );

  const startCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    videoRef.current.play();
    setState("CAPTURING");
  };

  const stopCapture = () => {
    videoRef.current.srcObject.getVideoTracks().forEach((track) => {
      track.stop();
    });
    setState("IDLE");
  };

  const restartCapture = () => {
    setResult("");
    startCapture();
  };

  const recognize = async () => {
    setState("RECOGNIZING");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas
      .getContext("2d")
      .drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    const image = canvas.toDataURL("image/jpeg", 0.95);

    videoRef.current.srcObject.getVideoTracks().forEach((track) => {
      track.stop();
    });

    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What is this? Be concise in your response. Do not include any extra information.",
            },
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
    });

    setResult(result.choices[0].message.content);
  };

  return (
    <div>
      <div>
        {state === "IDLE" && (
          <button onClick={startCapture}>Start Capture</button>
        )}
        {state === "CAPTURING" && (
          <button onClick={stopCapture}>Stop Capture</button>
        )}
        {state === "CAPTURING" && (
          <button onClick={recognize}>Recognize Object</button>
        )}
        {state === "RECOGNIZING" && (
          <button onClick={restartCapture}>Restart Capture</button>
        )}
      </div>
      <video
        ref={videoRef}
        style={{
          display: state === "CAPTURING" ? "block" : "none",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          display: state === "RECOGNIZING" ? "block" : "none",
        }}
      />
      {result && <p>Result: {result}</p>}
    </div>
  );
}

function App() {
  const [credential, setCredential] = useState();

  if (!credential) {
    return (
      <div className="login">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            setCredential(credentialResponse.credential);
          }}
          onError={() => {
            console.error("Login Failed");
          }}
        />
      </div>
    );
  }

  return <Recognizer credential={credential} />;
}

export default App;
