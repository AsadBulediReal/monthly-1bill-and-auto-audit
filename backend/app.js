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
    console.error("Archive error:", err);
    res.status(500).json({ error: "Failed to create archive" });
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
      console.error("Archive warning:", err);
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
    
    const readStream = fs.createReadStream(archiveName);
    readStream.pipe(res);

    readStream.on("end", () => {
      // Cleanup after stream ends
      setTimeout(() => {
        try {
          // Check if ZIP file exists before deleting
          if (fs.existsSync(archiveName)) {
            fs.unlinkSync(archiveName);
            console.log("ZIP file deleted successfully");
          }
        } catch (err) {
          console.error("Error deleting ZIP file:", err);
        }

        try {
          // Check if generated-report folder exists before deleting
          const folderPath = path.join(__dirname, "generated-report");
          if (fs.existsSync(folderPath)) {
            fs.rmSync(folderPath, { recursive: true });
            console.log("Generated report folder deleted successfully");
          }
        } catch (err) {
          console.error("Error deleting report folder:", err);
        }
      }, 1000);
    });

    readStream.on("error", (err) => {
      console.error("Stream error:", err);
      res.status(500).json({ error: "Failed to send file" });
    });
  });

  archive.finalize();
};

app.post("/report", async (req, res) => {
  try {
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

      const name = fileName + ".xlsx"; // fixed space before extension
      const savedFilePath = path.join(__dirname, "generated-report", name);
      xlsx.writeFile(workbook, savedFilePath);
      return name;
    };

    const fromDateFormated = new Date(fromDate);
    const toDateFormated = new Date(toDate);
    toDateFormated.setHours(23, 59, 59, 999);

    const getSelectedData = [...selectedData, "nullData"];

  const reportSummary = {}; // store data for each category
  const summaryStats = []; // 🟢 NEW: will hold summary rows
  let grandTotalRecords = 0;
  let grandTotalAmount = 0;

  const createdfiles = [];

  for (const selectedCategory of getSelectedData) {
    console.log(`Querying ${selectedCategory} for date range: ${fromDate} to ${toDate}`);
    console.log(`Formatted dates: ${fromDateFormated} to ${toDateFormated}`);
    
    // First, check if any records exist in this collection
    const totalCount = await db[selectedCategory].countDocuments();
    console.log(`Total documents in ${selectedCategory}: ${totalCount}`);
    
    // Query with date filter
    const getReport = await db[selectedCategory]
      .find({
        "PAID_DATE": { $gte: fromDateFormated, $lte: toDateFormated },
      })
      .select("-__v")
      .exec();

    console.log(`Found ${getReport.length} records in ${selectedCategory} for date range`);
    
    // Log sample record if exists
    if (getReport.length > 0) {
      console.log("Sample record:", JSON.stringify(getReport[0], null, 2));
    }

    const data = [];
    const jsondata = JSON.stringify(getReport);
    const parsedData = JSON.parse(jsondata);

    parsedData.forEach((item) => {
      const formattedDate = new Date(item["PAID_DATE"])
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .split(" ");
      const date = `${formattedDate[0]}-${formattedDate[1]}-${formattedDate[2]}`;

      const updateDate = { ...item, "PAID_DATE": date };

      reportSummary[selectedCategory] = reportSummary[selectedCategory] || [];
      reportSummary[selectedCategory].push(updateDate);
      data.push(updateDate);
    });

    // 🟢 NEW: Calculate totals for this category
    const totalRecords = data.length;
    const totalAmount = data.reduce((sum, row) => {
      const val = parseFloat(row.PAID_AMOUNT || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    summaryStats.push({
      Category: selectedCategory,
      "Total Records": totalRecords,
      "Total Amount": totalAmount.toFixed(2),
    });

    grandTotalRecords += totalRecords;
    grandTotalAmount += totalAmount;

    const fileName = createFile(data, selectedCategory);
    createdfiles.push(fileName);
  }

  // 🟢 NEW: Add overall totals row
  summaryStats.push({
    Category: "All Categories",
    "Total Records": grandTotalRecords,
    "Total Amount": grandTotalAmount.toFixed(2),
  });

  // 🟢 NEW: Create summary Excel file
  const summaryFile = createFile(summaryStats, "summary");
  createdfiles.push(summaryFile);

  // zip and send all files
  if (
    fs.existsSync(path.join(__dirname, "generated-report", createdfiles[0]))
  ) {
    zipFile(createdfiles, res);
  }
  } catch (error) {
    console.error("Error in /report endpoint:", error);
    return res.status(500).json({
      status: 500,
      message: "Error generating report",
      title: "Report Generation Failed",
      error: error.message
    });
  }
});

app.post("/upload", async (req, res) => {
  const files = req.files;
  
  if (!files || Object.keys(files).length === 0) {
    return res.status(400).json({
      status: 400,
      message: "No files uploaded",
      title: "Missing Files",
    });
  }

  let filePath;

  try {
    // Move all files using Promise.all
    const filePromises = Object.keys(files).map((key) => {
      return new Promise((resolve, reject) => {
        const fPath = path.join(__dirname, "excel-file", files[key].name);
        filePath = fPath; // Store the path

        // Move the file to the destination directory.
        files[key].mv(fPath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });

    await Promise.all(filePromises);

    // Connect to database
    await db.connectDB();

    // Function to convert Excel to JSON
    const ConvetToJson = (excelFilePath) => {
      const workbook = xlsx.readFile(excelFilePath, {
        cellDates: true,
      });
      const sheetName = workbook.SheetNames[0];
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
      });
      return rawData;
    };

    // Wait a bit for file system to sync
    await new Promise(resolve => setTimeout(resolve, 500));

    // Read and process Excel file
    const data = await ConvetToJson(filePath);

    console.log("=== EXCEL DATA DEBUG ===");
    console.log("Total rows in Excel:", data.length);
    console.log("Header row:", data[0]);
    console.log("First 3 data rows:", data.slice(1, 4));
    console.log("========================");

    if (!data || data.length === 0) {
      throw new Error("Excel file is empty or invalid");
    }

    const categories = {
      10: "examination_semester",
      11: "examination_semester_convocation_fee",
      20: "admission_processing_fee",
      21: "admission_fee",
      22: "admission_retain",
      30: "drgs_admission_processing_fee",
      31: "drgs_challan",
      32: "drgs_convocation_fee",
      40: "hostel_accomodation_fee_boys",
      41: "hostel_accomodation_fee_girls",
      43: "hostel_accomodation_fee_girls_pg",
      50: "examination_annual_certificate",
      51: "general_branch_annual",
      52: "examination_annual_exam_fee",
      53: "general_branch_on_campus",
      54: "examination_semester_affailated_college",
      55: "examination_annual_convocation_fee",
      56: "general_branch_graduate_studies",
      61: "sutc",
      62: "career_portal_challan",
      70: "miscellaneous_alumni_registration_fee",
    };

    // Check if data already exists
    const getCategorie = data[11]?.[0]?.toString().substr(0, 2) || "";
    const categoryName = categories[getCategorie];

    if (categoryName) {
      const isTheDataExists = await db[categoryName].find({
        "Consumer No": data[11][0],
      });

      if (isTheDataExists && isTheDataExists.length > 0) {
        const folderPath = path.join(__dirname, "excel-file");
        fs.rmSync(folderPath, { recursive: true });
        return res.status(400).json({
          status: 400,
          message: "Please dont upload the already uploaded file",
          title: "Duplicate File",
        });
      }
    }

    // Filter and process valid data rows
    const execl = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i] && data[i].length > 0) {
        execl.push(data[i]);
      }
    }

    console.log("=== DATA FILTERING DEBUG ===");
    console.log("Total data rows after filtering:", execl.length);
    if (execl.length > 0) {
      console.log("First filtered record:", execl[0]);
      console.log("Record columns count:", execl[0].length);
    } else {
      console.log("WARNING: No valid data rows found!");
      console.log("Data array length:", data.length);
      console.log("Sample rows from data:", data.slice(1, 5));
    }
    console.log("============================");

    // If no data found, return error
    if (execl.length === 0) {
      throw new Error("No valid data rows found in Excel file");
    }

    // Check for duplicate file by comparing first and last CHALLAN_NO
    const firstChallan = String(execl[0][0] || "").trim();
    const lastChallan = String(execl[execl.length - 1][0] || "").trim();

    console.log("=== DUPLICATE FILE CHECK ===");
    console.log("First CHALLAN_NO from file:", firstChallan);
    console.log("Last CHALLAN_NO from file:", lastChallan);

    // Get the appropriate category from first record to check in database
    const firstTypeCode = String(execl[0][1] || "").trim().substr(0, 2);
    const duplicateCheckCategoryName = categories[firstTypeCode];

    if (duplicateCheckCategoryName) {
      // Query database for first and last CHALLAN
      const firstExists = await db[duplicateCheckCategoryName].findOne({ CHALLAN_NO: firstChallan });
      const lastExists = await db[duplicateCheckCategoryName].findOne({ CHALLAN_NO: lastChallan });

      console.log("First CHALLAN exists in DB:", !!firstExists);
      console.log("Last CHALLAN exists in DB:", !!lastExists);

      // Check if file has been uploaded before
      if (firstExists && lastExists) {
        // Both first and last CHALLAN exist - duplicate file
        const folderPath = path.join(__dirname, "excel-file");
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true });
        }
        return res.status(400).json({
          status: 400,
          message: `File already uploaded. Both first CHALLAN (${firstChallan}) and last CHALLAN (${lastChallan}) exist in database.`,
          title: "Duplicate File",
          details: {
            firstChallan: firstChallan,
            lastChallan: lastChallan,
            status: "Both records already exist"
          }
        });
      } else if (firstExists) {
        // Only first CHALLAN exists - partial file uploaded
        const folderPath = path.join(__dirname, "excel-file");
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true });
        }
        return res.status(400).json({
          status: 400,
          message: `This file appears to be already partially uploaded. First CHALLAN (${firstChallan}) already exists in database.`,
          title: "Duplicate File",
          details: {
            firstChallan: firstChallan,
            status: "First record already exists"
          }
        });
      } else if (lastExists) {
        // Only last CHALLAN exists - different file but overlapping
        const folderPath = path.join(__dirname, "excel-file");
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true });
        }
        return res.status(400).json({
          status: 400,
          message: `File contains overlapping records. Last CHALLAN (${lastChallan}) already exists in database.`,
          title: "Overlapping File",
          details: {
            lastChallan: lastChallan,
            status: "Last record already exists"
          }
        });
      }
    }

    console.log("=============================");

    // Helper function to clean Excel data (handle spaces as empty)
    const cleanValue = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string' && val.trim() === '') return null;
      return val;
    };

    // Helper function to parse and validate dates
    const parseDate = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return null;
        // Try to parse string as date
        const parsed = new Date(trimmed);
        if (isNaN(parsed.getTime())) return null; // Invalid date
        return parsed;
      }
      // If it's already a Date object
      if (val instanceof Date) return val;
      // Try to convert to date
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) return null;
      return parsed;
    };

    // Insert data into appropriate collections
    let logChallan = false;
    let savedCount = 0;
    
    for (const record of execl) {
      const getChallan = record[0]?.toString().substr(0, 2); // TYPE_CODE
      const getCategorie = categories[getChallan];

      if (!logChallan) {
        console.log("=== FIRST RECORD DEBUG ===");
        console.log("First record:", record);
        console.log("TYPE_CODE (record[1]):", record[1]);
        console.log("First 2 chars:", getChallan);
        console.log("Mapped category:", getCategorie);
        console.log("==========================");
        logChallan = true;
      }

      const recordData = {
        CHALLAN_NO: String(record[0] || "").trim() || "No Data",
        TYPE_CODE: String(record[1] || "").trim() || "No Data",
        DESCRIPTION: String(record[2] || "").trim() || "No Data",
        ROLL_NO: String(record[3] || "").trim() || "No Data",
        BATCH_ID: String(record[4] || "").trim() || "No Data",
        PAID_AMOUNT: parseFloat(record[5]) || 0,
        PAID_DATE: parseDate(record[6]) || new Date(),
        CNIC_NO: String(record[7] || "").trim() || "No Data",
        NAME: String(record[8] || "").trim() || "No Data",
        FNAME: String(record[9] || "").trim() || "No Data",
        SURNAME: String(record[10] || "").trim() || "No Data",
        MOBILE_NO: String(record[11] || "").trim() || "No Data",
        PROGRAM: String(record[12] || "").trim() || "No Data",
        REVERSED_TRANSACTION_ID: cleanValue(String(record[13] || "").trim()) || null,
        REVERSED_DATE: parseDate(record[14]),
        CHANNEL: String(record[15] || "").trim() || "No Data",
        FACULTY_NAME: String(record[16] || "").trim() || "No Data",
        DEPT_NAME: String(record[17] || "").trim() || "No Data",
        CAMPUS_NAME: String(record[18] || "").trim() || "No Data",
      };

      try {
        if (getCategorie === undefined) {
          await db["nullData"].create(recordData);
          savedCount++;
        } else {
          await db[getCategorie].create(recordData);
          savedCount++;
        }
      } catch (error) {
        console.error("Error creating record:", error.message);
      }
    }
    
    console.log(`Successfully saved ${savedCount} records out of ${execl.length}`);

    // Cleanup and respond
    const folderPath = path.join(__dirname, "excel-file");
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true });
    }

    return res.status(200).json({
      status: 200,
      message: "File successfully uploaded and processed",
      title: "Upload Success",
      recordsProcessed: execl.length,
    });

  } catch (error) {
    console.error("Error in upload endpoint:", error);
    
    // Cleanup on error
    const folderPath = path.join(__dirname, "excel-file");
    if (fs.existsSync(folderPath)) {
      try {
        fs.rmSync(folderPath, { recursive: true });
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }
    }

    return res.status(500).json({
      status: 500,
      message: "Server error during file upload",
      title: "Server Error",
      error: error.message,
    });
  }
});

app.listen("3000", () => {
  console.log("Server is running on port 3000");
});
