import { CloudUpload } from "lucide-react";

function UploadBox() {

  const handleFileChange = (event) => {

    const file = event.target.files[0];

    if (!file) return;

    console.log("Selected file:", file.name);

  };

  return (
    <section className="upload-container">

      <div className="upload-box">

        <CloudUpload
          size={52}
          className="upload-icon"
        />

        <h2>Upload Browser Extension</h2>

        <p>
          Upload a .zip or .crx file of the browser extension to analyze
        </p>

        <span className="upload-description">
          Drag and drop your file here, or click to browse
        </span>

        <label className="choose-file">

          Choose File

          <input
            type="file"
            accept=".zip,.crx"
            onChange={handleFileChange}
            hidden
          />

        </label>

        <small>
          Supported formats: .zip, .crx &nbsp; | &nbsp;
          Maximum file size: 50MB
        </small>

      </div>

    </section>
  );
}

export default UploadBox;