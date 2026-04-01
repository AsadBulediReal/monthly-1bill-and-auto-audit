import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { MultiSelect } from "react-multi-select-component";

const options = [
  { label: "EXAMINATION SEMESTER", value: "examination_semester" },
  {
    label: "EXAMINATION SEMESTER CONVOCATION FEE",
    value: "examination_semester_convocation_fee",
  },
  { label: "ADMISSION PROCESSING FEE", value: "admission_processing_fee" },
  { label: "ADMISSION FEE", value: "admission_fee" },
  { label: "ADMISSION (RETAIN)", value: "admission_retain" },
  {
    label: "DRGS ADMISSION PROCESSING FEE",
    value: "drgs_admission_processing_fee",
  },
  { label: "DRGS CHALLAN", value: "drgs_challan" },
  { label: "DRGS CONVOCATION FEE", value: "drgs_convocation_fee" },
  {
    label: "HOSTEL ACCOMODATION FEE (BOYS)",
    value: "hostel_accomodation_fee_boys",
  },
  {
    label: "HOSTEL ACCOMODATION FEE (GIRLS)",
    value: "hostel_accomodation_fee_girls",
  },
  {
    label: "HOSTEL ACCOMODATION FEE (GIRLS) P.G",
    value: "hostel_accomodation_fee_girls_pg",
  },
  {
    label: "EXAMINATION ANNUAL (CERTIFICATE)",
    value: "examination_annual_certificate",
  },
  { label: "GENERAL BRANCH (ANNUAL)", value: "general_branch_annual" },
  {
    label: "EXAMINATION ANNUAL (EXAM FEE)",
    value: "examination_annual_exam_fee",
  },
  { label: "GENERAL BRANCH (ON CAMPUS)", value: "general_branch_on_campus" },
  {
    label: "EXAMINATION SEMESTER (AFFAILATED COLLEGE)",
    value: "examination_semester_affailated_college",
  },
  {
    label: "EXAMINATION ANNUAL CONVOCATION FEE",
    value: "examination_annual_convocation_fee",
  },
  {
    label: "GENERAL BRANCH GRADUATE STUDIES",
    value: "general_branch_graduate_studies",
  },
  { label: "SUTC", value: "sutc" },
  { label: "Career Portal challan", value: "career_portal_challan" },
  {
    label: "MISCELLANEOUS (ALUMNI REGISTRATION FEE)",
    value: "miscellaneous_alumni_registration_fee",
  },
];

const ByCmdAccount = ({ change, selected, setSelected }) => {
  return (
    <>
      <div className="by-cmd">
        <h1>Get Report</h1>
        <div>
          <MultiSelect
            options={options}
            value={selected}
            onChange={setSelected}
            labelledBy="Select"
          />
          <div className="date-container">
            <div className="date">
              <label htmlFor="from">From Date :</label>
              <input
                id="from"
                type="date"
                name="fromDate"
                onChange={change}
                required
              />
            </div>
            <div className="date">
              <label htmlFor="to">To Date :</label>
              <input
                id="to"
                type="date"
                name="toDate"
                onChange={change}
                required
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const ReportGeneration = ({ users }) => {
  const [formData, setFormData] = useState({});
  const [selected, setSelected] = useState([]);

  console.log(selected);
  const handleChange = (e) => {
    const { name, value } = e.target;

    const formattedDate = new Date(value).toLocaleDateString("en-US");
    let date = formattedDate;
    setFormData((prevInputValues) => ({
      ...prevInputValues,
      [name]: date,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Get all of the form input elements.
    const formInputs = Array.from(event.target.elements);
    if (selected.length < 1) {
      toast.error("Please select a challan category");
      return;
    }

    // Clear the value of each form input element.
    formInputs.forEach((input) => {
      input.value = "";
    });

    const selectedData = [];

    for (let i = 0; i < selected.length; i++) {
      selectedData.push(selected[i].value);
    }
    console.log(selectedData);

    const data = { ...formData, selectedData: selectedData };

    console.log(data);
    try {
      const reportData = await toast.promise(
        axios({
          method: "post",
          url: "http://localhost:3000/report",
          data: JSON.stringify(data),
          responseType: "blob",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        {
          pending: "Getting report data...",
          success: "Report data!",
          error: {
            render({ data }) {
              return data.response
                ? data.response.data.message
                : "Failed to get data from server";
            },
          },
        }
      );

      const excelBlob = new Blob([reportData.data]);
      const url = URL.createObjectURL(excelBlob);
      const link = document.createElement("a");
      link.href = url;
      const formattedDate = new Date().toLocaleDateString("en-GB");
      link.download = "Report " + formattedDate + ".zip"; // Use a descriptive filename
      link.click();

      setSelected([]);
      setFormData({});
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="report">
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <ByCmdAccount
            change={handleChange}
            selected={selected}
            setSelected={setSelected}
          />
        </div>
        <div className="button">
          <button className="btn" type="submit">
            Generate Report
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportGeneration;
