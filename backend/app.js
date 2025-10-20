require("dotenv").config();

const app = require("express")();
const fileUpload = require("express-fileupload");
const fs = require("fs");
const xlsx = require("xlsx");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db/db");
const archiver = require("archiver");
app.use(cors());

// Add the express-fileupload middleware
app.use(fileUpload({ createParentPath: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Use body-parser.json for JSON data

const zipFile = (createdfiles, res) => {
  const archiveName = "report.zip";

  const output = fs.createWriteStream(archiveName);
  const archive = archiver("zip");

  archive.on("error", (err) => {
    throw err; // Rethrow error for Express error handling
  });

  output.on("end", function () {
    console.log("Data has been drained");
  });

  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on("warning", function (err) {
    if (err.code === "ENOENT") {
      // log warning
    } else {
      // throw error
      throw err;
    }
  });

  archive.pipe(output);

  createdfiles.forEach((file) => {
    const filePath = path.join(__dirname, "generated-report", file);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: file }); // Preserve original filenames in the archive
    }
  });

  output.on("close", () => {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${archiveName}`);
    fs.createReadStream(archiveName).pipe(res);
    setTimeout(() => {
      const folderPath = path.join(__dirname, "generated-report");
      fs.unlinkSync(archiveName);
      fs.rmSync(folderPath, { recursive: true });
    }, 1500);
  });
  archive.finalize();
};

app.post("/report", async (req, res) => {
  const { fromDate, toDate, selectedData } = req.body;
  await db.connectDB();

  const createFile = (data, fileName) => {
    const dataToJson = JSON.stringify(data);
    const worksheet = xlsx.utils.json_to_sheet(JSON.parse(dataToJson));
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    if (!fs.existsSync("generated-report")) {
      fs.mkdirSync("generated-report");
    }

    const name = fileName + " .xlsx";

    const savedFilePath = path.join(__dirname, "generated-report", name);
    xlsx.writeFile(workbook, savedFilePath);
    return name;
  };
  const fromDateFormated = new Date(fromDate);
  const toDateFormated = new Date(toDate);
  toDateFormated.setHours(23, 59, 59, 999);

  const getSelectedData = [...selectedData, "nullData"];

  const createdfiles = [];
  for (const selectedCategory of getSelectedData) {
    const getReport = await db[selectedCategory]
      .find({
        "Transaction Date": { $gte: fromDateFormated, $lte: toDateFormated },
      })
      .select("-comments -__v -_id")
      .exec();

    const data = [];
    const jsondata = JSON.stringify(getReport);
    const parsedData = JSON.parse(jsondata);

    parsedData.forEach((item) => {
      const formattedDate = new Date(item["Transaction Date"])
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .split(" ");
      const date = `${formattedDate[0]}-${formattedDate[1]}-${formattedDate[2]}`;

      const updateDate = {
        ...item,
        "Transaction Date": date,
      };
      data.push(updateDate);
    });

    const fileName = createFile(data, selectedCategory);
    createdfiles.push(fileName);
  }

  if (
    fs.existsSync(path.join(__dirname, "generated-report", createdfiles[0]))
  ) {
    zipFile(createdfiles, res);
  }
});

app.post("/upload", async (req, res) => {
  const files = req.files;

  // Declare the variable `exists` outside of the `forEach()` loop.
  let exists = false;
  let file;
  let fileName;

  Object.keys(files).forEach(async (key) => {
    const filePath = path.join(__dirname, "excel-file", files[key].name);
    file = filePath;
    fileName = files[key].name;

    // Move the file to the destination directory.
    await files[key].mv(filePath, (err) => {
      if (err) {
        return res.status(200).json({
          status: 500,
          message: "Upload failed server side error",
          title: "Upload Failed",
        });
      }
    });
  });

  await db.connectDB();

  async function ConvetToJson(excelFilePath) {
    const workbook = xlsx.readFile(excelFilePath, {
      cellDates: true,
    });
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
    });
    return rawData;
  }

  const auditData = async (data) => {
    const categories = {
      10: "examination_semester",
      20: "admission_processing_fee",
      21: "admission_fee",
      22: "admission_retain",
      30: "drgs_admission_processing_fee",
      31: "drgs_challan",
      40: "hostel_accomodation_fee_boys",
      41: "hostel_accomodation_fee_girls",
      43: "hostel_accomodation_fee_girls_pg",
      50: "examination_annual_certificate",
      51: "general_branch_annual",
      52: "examination_annual_exam_fee",
      53: "general_branch_on_campus",
      54: "examination_semester_affailated_college",
      61: "sutc",
    };

    let logChallan;
    data.map(async (record) => {
      const getChallan = record[0]?.toString().substr(0, 2);
      const getCategorie = await categories[getChallan];
      const challan = Number(record[0]);

      if (logChallan !== true) {
        console.log("audit data");
        console.log(record);
        logChallan = true;
      }

      if (getCategorie === undefined) {
        db["nullData"].create({
          "Agent Transaction ID": 0,
          "Tran Id": 0,
          "Consumer No": challan || 0,
          "Consumer Name": record[1] || "No Data",
          Company: record[3] || "No Data",
          Amount: record[4] || 0,
          Channel: record[5] || "No Data",
          "Transaction Date": record[6] || 0,
          Code: record[13],
        });
        return;
      }

      db[getCategorie].create({
        "Agent Transaction ID": 0,
        "Tran Id": 0,
        "Consumer No": challan || 0,
        "Consumer Name": record[1] || "No Data",
        Company: record[3] || "No Data",
        Amount: record[4] || 0,
        Channel: record[5] || "No Data",
        "Transaction Date": record[6] || 0,
        Code: record[13],
      });
    });
  };

  setTimeout(async () => {
    const data = await ConvetToJson(file);

    // if (data[1][0] !== "AUTO HBPS COMPANIES DAILY MIS") {
    //   exists = true;
    //   res.status(200).json({
    //     status: 400,
    //     message: "Please dont upload wrong file",
    //     title: "Wrong file",
    //   });
    //   const folderPath = path.join(__dirname, "excel-file");
    //   fs.rmSync(folderPath, { recursive: true });
    //   return;
    // }
    const categories = {
      10: "examination_semester",
      20: "admission_processing_fee",
      21: "admission_fee",
      22: "admission_retain",
      30: "drgs_admission_processing_fee",
      31: "drgs_challan",
      40: "hostel_accomodation_fee_boys",
      41: "hostel_accomodation_fee_girls",
      43: "hostel_accomodation_fee_girls_pg",
      50: "examination_annual_certificate",
      51: "general_branch_annual",
      52: "examination_annual_exam_fee",
      53: "general_branch_on_campus",
      54: "examination_semester_affailated_college",
      61: "sutc",
    };

    const getCategorie = data[11][0].toString().substr(0, 2);
    const isTheDataExsits = await db[categories[getCategorie]].find({
      "Consumer No": data[11][0],
    });

    if (isTheDataExsits.length > 0) {
      exists = true;
      res.status(200).json({
        status: 400,
        message: "please dont upload the already uploaded file",
        title: "Same File",
      });
      const folderPath = path.join(__dirname, "excel-file");
      fs.rmSync(folderPath, { recursive: true });
      return;
    }
    const execl = [];
    for (let i = 0; i < data.length; i++) {
      if (i > 0) {
        if (data[i].length > 0) {
          execl.push(data[i]);
        }
      }
    }
    console.log(execl[0]);
    console.log(execl[1]);
    console.log(execl[2]);

    await auditData(execl);
    if (!exists) {
      const folderPath = path.join(__dirname, "excel-file");
      fs.rmSync(folderPath, { recursive: true });
      return res.status(200).json({
        status: 200,
        message: "file successfully uploaded",
        data: execl,
      });
    }
  }, 1000);
});

app.listen("3000", () => {
  console.log("Server is running on port 3000");
});
