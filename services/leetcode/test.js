import fs from "fs";

// read JSON and parse it into an array of objects
const questions = JSON.parse(
  fs.readFileSync("./leetcode_questions.json", "utf8"),
);

let allSame = true;
for (const data of questions) {
  if (data.questionId !== data.questionFrontendId) {
    console.log(data.questionId, data.questionFrontendId);
    allSame = false;
    break;
  }
}

if (allSame) {
  console.log("All questionId and questionFrontendId are the same!");
}
