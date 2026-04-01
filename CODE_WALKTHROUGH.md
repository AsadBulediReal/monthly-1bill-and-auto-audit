# Papa Office App - Code Walkthrough

## Table of Contents
1. [Project Overview](#project-overview)
2. [Dependencies & Setup](#dependencies--setup)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [File Upload Process](#file-upload-process)
6. [Report Generation Process](#report-generation-process)
7. [Category Mapping](#category-mapping)
8. [Error Handling](#error-handling)

---

## Project Overview

**Papa Office App** is an audit management system that allows users to:
- **Upload** Excel files containing financial transaction records
- **Store** records in MongoDB organized by category
- **Generate** filtered audit reports for specific date ranges
- **Download** reports as ZIP files

**Tech Stack:**
- Backend: Node.js with Express
- Database: MongoDB with Mongoose
- File Processing: XLSX (Excel), Archiver (ZIP)
- Middleware: CORS, Body Parser, Express File Upload

---

## Dependencies & Setup

### Lines 1-17 in `app.js`

```javascript
require("dotenv").config();              // Load environment variables from .env file
const app = require("express")();        // Create Express application instance
const fileUpload = require("express-fileupload");  // Handle file uploads
const fs = require("fs");                // File system operations
const xlsx = require("xlsx");            // Read/write Excel files
const path = require("path");            // Work with file paths
const cors = require("cors");            // Enable cross-origin requests
const bodyParser = require("body-parser");  // Parse request body (JSON/URL-encoded)
const db = require("./db/db");           // Import MongoDB models
const archiver = require("archiver");    // Create ZIP archives
app.use(cors());                         // Enable CORS on all routes
```

### Middleware Configuration (Lines 14-17)

```javascript
app.use(fileUpload({ createParentPath: true }));  // Auto-create directories for uploads
app.use(bodyParser.urlencoded({ extended: true }));  // Parse form data
app.use(bodyParser.json());  // Parse JSON data
```

---

## Database Schema

### Location: `backend/db/db.js`

#### Main Schema (`sechema`)

```javascript
const sechema = new mongoose.Schema({
  TYPE_CODE: { type: String, required: true },           // e.g., "10-001"
  DESCRIPTION: { type: String, required: true },         // e.g., "MARKS CERTIFICATE"
  CHALLAN_NO: { type: String, required: true },          // Unique challan number
  ROLL_NO: { type: String },                             // Student roll number
  BATCH_ID: { type: String },                            // Batch identifier
  PAID_DATE: { type: Date, required: true },             // Payment date
  PAID_AMOUNT: { type: Number, required: true },         // Amount paid
  CNIC_NO: { type: String },                             // National ID number
  NAME: { type: String, required: true },                // Student/person name
  FNAME: { type: String },                               // Father's name
  SURNAME: { type: String },                             // Surname
  MOBILE_NO: { type: String },                           // Contact number
  EMAIL: { type: String },                               // Email address
  PROGRAM: { type: String },                             // Degree program
  PROG_CODE: { type: String },                           // Program code
  REVERSED_TRANSACTION_ID: { type: String },             // Refund transaction ID
  REVERSED_DATE: { type: Date },                         // Refund date
  CHANNEL: { type: String },                             // Payment channel
  FACULTY_NAME: { type: String },                        // Faculty name
  DEPT_NAME: { type: String },                           // Department name
  CAMPUS_NAME: { type: String },                         // Campus location
});
```

#### Null Schema (`nullSechema`)

Same structure as above but with **optional fields** (no `required: true`). Used for records with unrecognized TYPE_CODEs.

#### Collections Mapping

Each TYPE_CODE maps to a specific MongoDB collection:

```
TYPE_CODE "10" → "examination_semester" collection
TYPE_CODE "11" → "examination_semester_convocation_fee" collection
TYPE_CODE "20" → "admission_processing_fee" collection
... and so on (see Category Mapping section)
```

---

## API Endpoints

### 1. POST `/upload`

**Purpose:** Upload Excel file and store records in MongoDB

**Request:**
```
Content-Type: multipart/form-data
Body: {
  files: [Excel file]
}
```

**Response Success (200):**
```json
{
  "status": 200,
  "message": "File successfully uploaded and processed",
  "title": "Upload Success",
  "recordsProcessed": 1250
}
```

**Response Error (400/500):**
```json
{
  "status": 400,
  "message": "Please dont upload the already uploaded file",
  "title": "Duplicate File"
}
```

**Process Detailed:**

#### Step 1: Validate Input
```javascript
if (!files || Object.keys(files).length === 0) {
  return res.status(400).json({
    status: 400,
    message: "No files uploaded",
    title: "Missing Files",
  });
}
```

#### Step 2: Move Files to Server
```javascript
const filePromises = Object.keys(files).map((key) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "excel-file", files[key].name);
    filePath = filePath;  // Store for later use

    files[key].mv(filePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});

await Promise.all(filePromises);  // Wait for all uploads
```

**What happens:**
- Uploaded file saved to `backend/excel-file/` folder
- Promise.all ensures all files are moved before continuing
- Rejects if file move fails

#### Step 3: Connect to Database
```javascript
await db.connectDB();  // Establish MongoDB connection with timeout
```

#### Step 4: Convert Excel to JSON Array
```javascript
const ConvetToJson = (excelFilePath) => {
  const workbook = xlsx.readFile(excelFilePath, {
    cellDates: true,  // Parse dates as Date objects
  });
  const sheetName = workbook.SheetNames[0];  // Get first sheet
  const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,  // Output as array format (not object)
    raw: false, // Keep as strings
  });
  return rawData;
};

const data = await ConvetToJson(filePath);
```

**Output Format:**
```javascript
[
  ["TYPE_CODE", "DESCRIPTION", "CHALLAN_NO", ...],  // Header row (index 0)
  ["10-001", "MARKS CERTIFICATE", "100758930", ...], // Data row 1
  ["10-001", "MARKS CERTIFICATE", "100758956", ...], // Data row 2
  ...
]
```

#### Step 5: Check for Duplicate File
```javascript
const getCategorie = data[11]?.[0]?.toString().substr(0, 2) || "";
const categoryName = categories[getCategorie];

if (categoryName) {
  const isTheDataExists = await db[categoryName].find({
    "Consumer No": data[11][0],  // Check CHALLAN_NO of first data row
  });

  if (isTheDataExists.length > 0) {
    // Same file already uploaded
    fs.rmSync(folderPath, { recursive: true });  // Delete uploaded file
    return res.status(400).json({
      status: 400,
      message: "Please dont upload the already uploaded file",
      title: "Duplicate File",
    });
  }
}
```

**Logic:**
- Gets TYPE_CODE from first data row (row 11)
- Extracts first 2 characters (e.g., "10" from "10-001")
- Looks up which MongoDB collection this maps to
- Queries if CHALLAN_NO already exists
- If yes = duplicate, reject upload

#### Step 6: Filter Valid Data Rows
```javascript
const execl = [];
for (let i = 1; i < data.length; i++) {  // Start from 1 (skip header)
  if (data[i] && data[i].length > 0) {
    execl.push(data[i]);
  }
}
```

**Result:** `execl` contains only valid data rows (no header, no empty rows)

#### Step 7: Process & Save Records
```javascript
let logChallan = false;
for (const record of execl) {
  const getChallan = record[0]?.toString().substr(0, 2);  // First 2 chars of TYPE_CODE
  const getCategorie = categories[getChallan];            // Get collection name

  if (!logChallan) {
    console.log("First record being processed:", record);
    logChallan = true;
  }

  const recordData = {
    TYPE_CODE: String(record[0]) || "No Data",           // Column 0
    DESCRIPTION: String(record[1]) || "No Data",         // Column 1
    CHALLAN_NO: String(record[2]) || "No Data",          // Column 2
    ROLL_NO: String(record[3]) || "No Data",             // Column 3
    BATCH_ID: String(record[4]) || "No Data",            // Column 4
    PAID_DATE: record[5] || new Date(),                  // Column 5
    PAID_AMOUNT: parseFloat(record[6]) || 0,             // Column 6 → Convert to number
    CNIC_NO: String(record[7]) || "No Data",             // Column 7
    NAME: String(record[8]) || "No Data",                // Column 8
    FNAME: String(record[9]) || "No Data",               // Column 9
    SURNAME: String(record[10]) || "No Data",            // Column 10
    MOBILE_NO: String(record[11]) || "No Data",          // Column 11
    EMAIL: String(record[12]) || "No Data",              // Column 12
    PROGRAM: String(record[13]) || "No Data",            // Column 13
    PROG_CODE: String(record[14]) || "No Data",          // Column 14
    REVERSED_TRANSACTION_ID: String(record[15]) || "",   // Column 15
    REVERSED_DATE: record[16] || null,                   // Column 16
    CHANNEL: String(record[17]) || "No Data",            // Column 17
    FACULTY_NAME: String(record[18]) || "No Data",       // Column 18
    DEPT_NAME: String(record[19]) || "No Data",          // Column 19
    CAMPUS_NAME: String(record[20]) || "No Data",        // Column 20
  };

  try {
    if (getCategorie === undefined) {
      await db["nullData"].create(recordData);  // Unknown category
    } else {
      await db[getCategorie].create(recordData);  // Save to mapped collection
    }
  } catch (error) {
    console.error("Error creating record:", error.message);
  }
}
```

**Important Notes:**
- Each Excel column maps to specific array index (0-20)
- PAID_AMOUNT converted to number with `parseFloat()`
- Other fields kept as strings
- If TYPE_CODE doesn't match any category → saves to "nullData" collection

#### Step 8: Cleanup & Return Response
```javascript
const folderPath = path.join(__dirname, "excel-file");
if (fs.existsSync(folderPath)) {
  fs.rmSync(folderPath, { recursive: true });  // Delete uploaded files
}

return res.status(200).json({
  status: 200,
  message: "File successfully uploaded and processed",
  title: "Upload Success",
  recordsProcessed: execl.length,
});
```

---

### 2. POST `/report`

**Purpose:** Generate audit reports for specific date range and categories

**Request:**
```json
{
  "fromDate": "2025-01-01",
  "toDate": "2025-12-31",
  "selectedData": ["examination_semester", "admission_fee"]
}
```

**Response:** ZIP file containing Excel reports

**Process:**

#### Step 1: Initialize
```javascript
const { fromDate, toDate, selectedData } = req.body;
await db.connectDB();

const fromDateFormated = new Date(fromDate);
const toDateFormated = new Date(toDate);
toDateFormated.setHours(23, 59, 59, 999);  // Include full day

const getSelectedData = [...selectedData, "nullData"];  // Always include nullData
```

#### Step 2: Create Excel File Function
```javascript
const createFile = (data, fileName) => {
  const dataToJson = JSON.stringify(data);
  const worksheet = xlsx.utils.json_to_sheet(JSON.parse(dataToJson));
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  if (!fs.existsSync("generated-report")) {
    fs.mkdirSync("generated-report");  // Create folder if not exists
  }

  const name = fileName + ".xlsx";
  const savedFilePath = path.join(__dirname, "generated-report", name);
  xlsx.writeFile(workbook, savedFilePath);
  return name;
};
```

**What it does:**
- Converts data to Excel format
- Creates "generated-report" folder if needed
- Saves file with category name
- Returns filename for ZIP archiving

#### Step 3: Query & Process Each Category
```javascript
for (const selectedCategory of getSelectedData) {
  const getReport = await db[selectedCategory]
    .find({
      "PAID_DATE": { $gte: fromDateFormated, $lte: toDateFormated },
    })
    .select("-comments -__v -_id")  // Exclude internal fields
    .exec();

  const data = [];
  const jsondata = JSON.stringify(getReport);
  const parsedData = JSON.parse(jsondata);

  parsedData.forEach((item) => {
    // Format date from MongoDB format to "DD-MMM-YYYY"
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

  // Calculate totals for this category
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
```

**Key Operations:**
- Query MongoDB for records in date range
- Format dates to "DD-MMM-YYYY" format
- Calculate category totals
- Create separate Excel file per category
- Accumulate overall totals

#### Step 4: Create Summary File
```javascript
summaryStats.push({
  Category: "All Categories",
  "Total Records": grandTotalRecords,
  "Total Amount": grandTotalAmount.toFixed(2),
});

const summaryFile = createFile(summaryStats, "summary");
createdfiles.push(summaryFile);
```

#### Step 5: Zip & Send Files
```javascript
if (
  fs.existsSync(path.join(__dirname, "generated-report", createdfiles[0]))
) {
  zipFile(createdfiles, res);
}
```

**zipFile Function (Lines 19-59):**
```javascript
const zipFile = (createdfiles, res) => {
  const archiveName = "report.zip";

  const output = fs.createWriteStream(archiveName);  // Create ZIP file
  const archive = archiver("zip");

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);

  // Add each Excel file to ZIP
  createdfiles.forEach((file) => {
    const filePath = path.join(__dirname, "generated-report", file);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: file });
    }
  });

  output.on("close", () => {
    // Send ZIP to client
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${archiveName}`);
    fs.createReadStream(archiveName).pipe(res);

    // Delete temporary files after sending
    setTimeout(() => {
      const folderPath = path.join(__dirname, "generated-report");
      fs.unlinkSync(archiveName);
      fs.rmSync(folderPath, { recursive: true });
    }, 1500);
  });

  archive.finalize();
};
```

**What it does:**
1. Creates ZIP archive
2. Adds all Excel files to ZIP
3. Streams ZIP to client as download
4. Deletes temporary files after download completes

---

## File Upload Process

### Complete Flow Diagram

```
User selects Excel file
         ↓
Browser sends POST /upload with file
         ↓
Server receives file object
         ↓
Move file to backend/excel-file/ folder
         ↓
Read Excel file with xlsx library
         ↓
Convert to JSON array (by columns)
         ↓
Check first data row in database (duplicate check)
         ↓
Filter valid data rows (skip header & empty)
         ↓
For each row:
  ├─ Extract TYPE_CODE
  ├─ Get first 2 chars
  ├─ Look up MongoDB collection name
  ├─ Map Excel columns to schema fields
  └─ Save to appropriate collection
         ↓
Delete uploaded file from server
         ↓
Send success response
         ↓
Frontend receives confirmation
```

### Example: Processing Single Record

```
Excel Row: ["10-001", "MARKS CERTIFICATE", "100758930", "2K21/PSL/12", ...]

↓ Step 1: Extract TYPE_CODE prefix
TYPE_CODE = "10-001"
First 2 chars = "10"

↓ Step 2: Look up category
categories["10"] = "examination_semester"

↓ Step 3: Map columns to fields
recordData = {
  TYPE_CODE: "10-001",
  DESCRIPTION: "MARKS CERTIFICATE",
  CHALLAN_NO: "100758930",
  ROLL_NO: "2K21/PSL/12",
  ...
}

↓ Step 4: Save to MongoDB
await db["examination_semester"].create(recordData)

↓ Result
Record saved in "examination_semester" collection
```

---

## Report Generation Process

### Complete Flow Diagram

```
User requests report
    ↓
Frontend sends POST /report with:
  - fromDate: "2025-01-01"
  - toDate: "2025-12-31"
  - selectedData: ["examination_semester", "admission_fee"]
    ↓
Server queries each category:
  - db["examination_semester"].find({PAID_DATE: {$gte, $lte}})
  - db["admission_fee"].find({PAID_DATE: {$gte, $lte}})
    ↓
Format dates: "2025-01-15" → "15-Jan-2025"
    ↓
Create Excel file for each category
    ↓
Calculate totals:
  - Total Records per category
  - Total Amount per category
    ↓
Create summary Excel with all totals
    ↓
Create ZIP archive containing:
  - examination_semester.xlsx
  - admission_fee.xlsx
  - summary.xlsx
    ↓
Send ZIP to frontend as download
    ↓
Delete temporary files
    ↓
User downloads report.zip
```

### Example: Query & Format

```javascript
// Query
const records = await db["examination_semester"].find({
  "PAID_DATE": {
    $gte: new Date("2025-01-01"),
    $lte: new Date("2025-12-31T23:59:59")
  }
});

// Result
[
  {
    _id: ObjectId(...),
    TYPE_CODE: "10-001",
    PAID_DATE: ISODate("2025-11-03T00:00:00Z"),
    PAID_AMOUNT: 800,
    ...
  }
]

// Format for Excel
{
  TYPE_CODE: "10-001",
  PAID_DATE: "03-Nov-2025",  // Formatted date
  PAID_AMOUNT: 800,
  ...
}

// Excel file created: examination_semester.xlsx
```

---

## Category Mapping

### TYPE_CODE → Collection Name

```javascript
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
```

### How It Works

1. **User uploads Excel** with TYPE_CODE "10-001"
2. **Code extracts** first 2 chars: "10"
3. **Maps to collection**: `categories["10"]` = "examination_semester"
4. **Saves record** to "examination_semester" collection in MongoDB
5. **Unknown codes** (not in categories object) → saved to "nullData" collection

### Adding New Categories

To add a new category type:

```javascript
// 1. Add to categories mapping
const categories = {
  ...
  80: "new_category_name",  // Add this line
  ...
};

// 2. Create MongoDB collection via db.js
const new_category = mongoose.model("new_category_name", sechema);

// 3. Export the model
module.exports = {
  ...
  new_category,
  ...
};
```

---

## Error Handling

### Upload Errors

| Error | Status | Message |
|-------|--------|---------|
| No files uploaded | 400 | "No files uploaded" |
| File move fails | 500 | "Server error during file upload" |
| Database connection fails | 500 | "Database connection failed" |
| Duplicate file | 400 | "Please dont upload the already uploaded file" |
| Invalid Excel format | 500 | "Excel file is empty or invalid" |
| Record save fails | Continues | Logged: "Error creating record: ..." |

### Report Generation Errors

| Error | Status | Message |
|-------|--------|---------|
| Missing parameters | 500 | "Error generating report" |
| No records found | 200 | Returns empty ZIP with summary file |
| Database connection fails | 500 | "Database connection failed" |

### Error Handling Code

```javascript
try {
  // Main process
  await Promise.all(filePromises);
  await db.connectDB();
  const data = await ConvetToJson(filePath);
  // ... more processing
} catch (error) {
  console.error("Error in upload endpoint:", error);
  
  // Cleanup on error
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
```

---

## Directory Structure

```
papa-office-app/
├── backend/
│   ├── app.js                    # Main Express server
│   ├── db/
│   │   └── db.js                # MongoDB schemas & models
│   ├── excel-file/              # Temporary upload folder
│   ├── generated-report/         # Temporary report files
│   ├── package.json
│   └── node_modules/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── components/
│   │       ├── Upload.jsx       # Upload Excel file
│   │       ├── ReportGeneration.jsx  # Generate reports
│   │       └── Navbar.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

---

## Environment Setup

### Required Files

**`.env` file (backend root):**
```
MONGODB_URI=mongodb://127.0.0.1:27017/auditdb
NODE_ENV=development
PORT=3000
```

**`package.json` dependencies:**
```json
{
  "dependencies": {
    "express": "^4.x.x",
    "mongoose": "^8.x.x",
    "xlsx": "^0.x.x",
    "archiver": "^6.x.x",
    "express-fileupload": "^1.x.x",
    "cors": "^2.x.x",
    "body-parser": "^1.x.x",
    "dotenv": "^16.x.x"
  }
}
```

---

## Running the Application

### Backend

```bash
cd backend
npm install
npm start
# Server runs on http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## Testing the Endpoints

### Test Upload

```bash
curl -X POST http://localhost:3000/upload \
  -F "files=@sample.xlsx"
```

### Test Report Generation

```bash
curl -X POST http://localhost:3000/report \
  -H "Content-Type: application/json" \
  -d '{
    "fromDate": "2025-01-01",
    "toDate": "2025-12-31",
    "selectedData": ["examination_semester", "admission_fee"]
  }' \
  --output report.zip
```

---

## Key Concepts

### MongoDB Collections

Collections are like database tables. Each category creates its own collection:
- `examination_semester` → stores TYPE_CODE "10" records
- `admission_fee` → stores TYPE_CODE "21" records
- `nullData` → stores unrecognized TYPE_CODEs

### Excel Array Format

Excel data is converted to array format where each row is an array:
```javascript
[
  ["Column1", "Column2", "Column3"],  // Row 0 (Header)
  ["Value1", "Value2", "Value3"],     // Row 1 (Data)
  ["Value4", "Value5", "Value6"]      // Row 2 (Data)
]
```

Index-based access: `record[0]` = first column, `record[1]` = second column, etc.

### Date Handling

- **Incoming:** Excel dates stored as Date objects
- **Storage:** MongoDB stores as ISO Date
- **Output:** Formatted to "DD-MMM-YYYY" in reports

### ZIP Archiving

Multiple Excel files are compressed into single ZIP for:
- Easier download
- Reduced file size
- Professional delivery

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot find module 'xlsx'" | Run `npm install xlsx` |
| "MongooseServerSelectionError" | Check MongoDB is running on port 27017 |
| "File move failed" | Check excel-file folder permissions |
| "Cannot read property '0' of undefined" | Excel file may be empty or have wrong format |
| "Cast error for Consumer No" | Ensure Consumer No column contains valid data |

---

**Last Updated:** January 12, 2026
**Version:** 1.0.0
