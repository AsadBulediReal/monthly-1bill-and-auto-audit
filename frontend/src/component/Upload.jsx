import React, { useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  AiOutlineCloudUpload,
  AiFillFileExcel,
  AiOutlineLoading3Quarters,
} from "react-icons/ai";
import { MdDeleteForever } from "react-icons/md";
import { BsCheck2Circle } from "react-icons/bs";
import { BiSolidError } from "react-icons/bi";

const UploadFile = () => {
  const [files, setFiles] = useState([]);
  const [sendfile, setSendFile] = useState();
  const [showProgress, setShowProgress] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState(false);
  const [oneFile, setOneFile] = useState(false);
  const [button, setButton] = useState(false);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  const handelFileInput = () => {
    fileInputRef.current.click();
  };

  const uploadFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if the files state array is not empty before setting the loading property.
    if (files.length > 0) {
      setFiles((prev) => {
        const newFiles = [...prev];
        newFiles[newFiles.length - 1].loading = 0;
        return newFiles;
      });
    }

    setSendFile(file);
    setOneFile(true);
    const maxLength = 15;
    const fileName = file.name.split(".")[0]; // Get the file name without the extension
    const extension = file.name.split(".").pop(); // Get the file extension

    if (extension !== "xlsx") {
      Swal.fire({
        position: "center",
        icon: "error",
        title: "Please choose the correct file formate",
        showConfirmButton: false,
        timer: 5000,
      });
      return removeFile();
    }

    let truncatedName = fileName;
    if (fileName.length > maxLength) {
      truncatedName = fileName.substring(0, maxLength); // Get the first 15 characters
      truncatedName += "... "; // Add ellipsis if the file name is longer than 15 characters
    }
    const result = `${truncatedName}.${extension}`;
    setFileName(result);
    setFiles([{ name: fileName, loading: 0 }]);
    setShowProgress(true);
    setOneFile(true);
  };

  const removeFile = () => {
    if (button) {
      return;
    }
    setFiles([]);
    setShowProgress(false);
    setOneFile(false);
    fileInputRef.current.value = null;
  };
  const onSubmit = async () => {
    const formData = new FormData();
    if (!fileName) return;

    formData.append(sendfile.name, sendfile);
    setButton(true);

    // Check if the files state array is not empty before trying to update it.
    if (files.length > 0) {
      try {
        setLoading(true);
        const response = await axios.post(
          "http://localhost:3000/upload",
          formData,
          {
            onUploadProgress: ({ loaded, total }) => {
              setFiles((prev) => {
                const newFiles = [...prev];
                newFiles[newFiles.length - 1].loading = Math.floor(
                  (loaded / total) * 100
                );
                return newFiles;
              });
              if (loaded === total) {
                const fileSize =
                  loaded < 1024
                    ? `${loaded} KB`
                    : `${(loaded / (1024 * 1024)).toFixed(2)} MB`;
                setUploadedFiles([{ name: fileName, size: fileSize }]); // Use loaded instead of total here
                setFiles([]);
                setShowProgress(false);
              }
            },
            headers: {
              "Content-Type": "multipart/form-data",
              "Access-Control-Allow-Origin": "*",
            },
            validateStatus: () => true,
          }
        );
        setLoading(false);
        console.log(response.ok)

        const handeldata = (response) => {
          console.log(response.status)
          if (response.data.status === 200) {
            setError(false);
            Swal.fire({
              position: "top-end",
              icon: "success",
              title: fileName + " Has Been Uploaded",
              showConfirmButton: false,
              timer: 2000,
            });
            return;
          } else if (response.data.status > 200) {
            Swal.fire({
              icon: "error",
              title: response.data.title,
              text: response.data.message,
              timer: 5000,
            });
            fileInputRef.current.value = null;
            setError(true);
          } else {
            fileInputRef.current.value = null;
            setError(true);
          }
        };

        handeldata(response);
        console.log(response);
        console.log(
          response.headers["content-disposition"]?.match(/filename="(.+)"/)[1]
        );
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Something went wrong!",
          timer: 2500,
        });
        fileInputRef.current.value = null;
        setError(true);
      }
    } else {
      Swal.fire({
        icon: "error",
        title: "Same File",
        text: "Please dont Upload the same file",
        timer: 5000,
      });
    }

    setOneFile(false);
    setButton(false);
  };

  return (
    <div className="upload-box">
      <p>Upload Flie</p>
      <form
        onClick={() => {
          if (oneFile) {
            Swal.fire({
              position: "center",
              icon: "error",
              title: "Please choose one file at a time",
              showConfirmButton: false,
              timer: 5000,
            });
            return;
          }
          handelFileInput();
        }}
      >
        <input
          className="file-input"
          type="file"
          name="execl-file"
          ref={fileInputRef}
          onChange={uploadFile}
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          disabled={oneFile}
        />

        <AiOutlineCloudUpload className="upload-icon" />
        <p>Browse File to Upload</p>
      </form>
      {showProgress && (
        <section className="loading-area">
          {showProgress &&
            files.map((file, i) => {
              return (
                <li className="row" key={i}>
                  <AiFillFileExcel />
                  <div className="content">
                    <div className="details">
                      <div className="name">{`${fileName} - Uploading`}</div>
                      <div className="percent">{file.loading}%</div>
                      <div className="loading-bar">
                        <div
                          className="loading"
                          style={{ width: `${file.loading}%` }}
                        ></div>
                      </div>
                      <MdDeleteForever
                        onClick={() => {
                          removeFile();
                        }}
                        style={{
                          color: "#e60000",
                          fontSize: "2rem",
                          cursor: "pointer",
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
        </section>
      )}

      <section className="uploaded-area">
        {uploadedFiles.map((file, i) => {
          return (
            <li className="row" key={i}>
              <div className="content upload">
                <AiFillFileExcel />
                <div className="details">
                  <span className="name">{fileName}</span>
                  <span className="size">{file.size}</span>
                </div>
              </div>
              {loading && (
                <AiOutlineLoading3Quarters className="loading" style={{ fontSize: "2rem" }} />
              )}
              {!loading && (
                <div>
                  {error ? (
                    <BiSolidError
                      style={{ color: "#e60000", fontSize: "2rem" }}
                    />
                  ) : (
                    <BsCheck2Circle className="check" />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </section>
      <button
        className="btn"
        type="submit"
        onClick={onSubmit}
        disabled={button}
      >
        Upload File
      </button>
    </div>
  );
};

export default UploadFile;
