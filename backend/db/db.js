const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/auditdb", {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
}

// const sechema = new mongoose.Schema({
//   "Agent Transaction ID": { type: Number, required: true },
//   "Tran Id": { type: Number, required: true },
//   "Consumer No": { type: Number, required: true },
//   "Consumer Name": { type: String, required: true },
//   Company: { type: String, required: true },
//   Amount: { type: Number, required: true },
//   Channel: { type: String, required: true },
//   Code: { type: String },
//   "Transaction Date": { type: Date, required: true },
// });

// const nullSechema = new mongoose.Schema({
//   "Agent Transaction ID": { type: Number },
//   "Tran Id": { type: Number },
//   "Consumer No": { type: Number },
//   "Consumer Name": { type: String },
//   Company: { type: String },
//   Amount: { type: Number },
//   Channel: { type: String },
//   Code: { type: String },
//   "Transaction Date": { type: Date },
// });

const sechema = new mongoose.Schema({
  CHALLAN_NO: { type: String, required: true },
  TYPE_CODE: { type: String, required: true },
  DESCRIPTION: { type: String, required: true },
  ROLL_NO: { type: String },
  BATCH_ID: { type: String },
  PAID_AMOUNT: { type: Number, required: true },
  PAID_DATE: { type: Date, required: true },
  CNIC_NO: { type: String },
  NAME: { type: String, required: true },
  FNAME: { type: String },
  SURNAME: { type: String },
  MOBILE_NO: { type: String },
  PROGRAM: { type: String },
  REVERSED_TRANSACTION_ID: { type: String },
  REVERSED_DATE: { type: Date },
  CHANNEL: { type: String },
  FACULTY_NAME: { type: String },
  DEPT_NAME: { type: String },
  CAMPUS_NAME: { type: String },
});

const nullSechema = new mongoose.Schema({
  CHALLAN_NO: { type: String },
  TYPE_CODE: { type: String },
  DESCRIPTION: { type: String },
  ROLL_NO: { type: String },
  BATCH_ID: { type: String },
  PAID_AMOUNT: { type: Number },
  PAID_DATE: { type: Date },
  CNIC_NO: { type: String },
  NAME: { type: String },
  FNAME: { type: String },
  SURNAME: { type: String },
  MOBILE_NO: { type: String },
  PROGRAM: { type: String },
  REVERSED_TRANSACTION_ID: { type: String },
  REVERSED_DATE: { type: Date },
  CHANNEL: { type: String },
  FACULTY_NAME: { type: String },
  DEPT_NAME: { type: String },
  CAMPUS_NAME: { type: String },
});

const examination_semester = mongoose.model("examination_semester", sechema);
const admission_processing_fee = mongoose.model(
  "admission_processing_fee",
  sechema
);
const admission_fee = mongoose.model("admission_fee", sechema);
const admission_retain = mongoose.model("admission_retain", sechema);
const drgs_admission_processing_fee = mongoose.model(
  "drgs_admission_processing_fee",
  sechema
);
const drgs_challan = mongoose.model("drgs_challan", sechema);
const hostel_accomodation_fee_boys = mongoose.model(
  "hostel_accomodation_fee_boys",
  sechema
);
const hostel_accomodation_fee_girls = mongoose.model(
  "hostel_accomodation_fee_girls",
  sechema
);
const hostel_accomodation_fee_girls_pg = mongoose.model(
  "hostel_accomodation_fee_girls_pg",
  sechema
);
const examination_annual_certificate = mongoose.model(
  "examination_annual_certificate",
  sechema
);
const general_branch_annual = mongoose.model("general_branch_annual", sechema);
const examination_annual_exam_fee = mongoose.model(
  "examination_annual_exam_fee",
  sechema
);
const general_branch_on_campus = mongoose.model(
  "general_branch_on_campus",
  sechema
);
const examination_semester_affailated_college = mongoose.model(
  "examination_semester_affailated_college",
  sechema
);
const sutc = mongoose.model("sutc", sechema);

const examination_semester_convocation_fee = mongoose.model(
  "examination_semester_convocation_fee",
  sechema
);

const drgs_convocation_fee = mongoose.model("drgs_convocation_fee", sechema);

const examination_annual_convocation_fee = mongoose.model(
  "examination_annual_convocation_fee",
  sechema
);

const general_branch_graduate_studies = mongoose.model(
  "general_branch_graduate_studies",
  sechema
);

const career_portal_challan = mongoose.model("career_portal_challan", sechema);

const miscellaneous_alumni_registration_fee = mongoose.model(
  "miscellaneous_alumni_registration_fee",
  sechema
);

const nullData = mongoose.model("nullData", nullSechema);

module.exports = {
  connectDB,
  examination_semester,
  admission_fee,
  admission_processing_fee,
  admission_retain,
  drgs_admission_processing_fee,
  drgs_challan,
  examination_annual_certificate,
  examination_annual_exam_fee,
  general_branch_annual,
  general_branch_on_campus,
  examination_semester_affailated_college,
  hostel_accomodation_fee_boys,
  hostel_accomodation_fee_girls,
  hostel_accomodation_fee_girls_pg,
  sutc,
  examination_semester_convocation_fee,
  drgs_convocation_fee,
  examination_annual_convocation_fee,
  general_branch_graduate_studies,
  career_portal_challan,
  miscellaneous_alumni_registration_fee,
  nullData,
};
