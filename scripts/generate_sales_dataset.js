const fs = require('fs');
const path = require('path');

const grades = ['Class 11', 'Class 12', 'Class 10'];
const boards = ['CBSE', 'ICSE', 'State Board', 'IB'];
const products = ['Aspirations', 'Study Abroad', 'School Partnerships'];

let csv = 'lead_id,student_name,grade,board,product_line,stage,counselor_connected,diagnostic_completed,application_started,enrolled,revenue_inr\n';

for (let i = 1; i <= 1000; i++) {
  // Use independent modulo cycles
  const grade = grades[i % 3];
  const board = boards[i % 4];
  const product = products[i % 3];
  
  // Realistic funnel progression
  const connected = i % 10 < 8 ? 1 : 0; // 80% connected
  const diagnostic = connected && (i % 5 < 3) ? 1 : 0; // 60% of connected
  const appStarted = diagnostic && (i % 3 < 2) ? 1 : 0; // ~66% of diagnostic
  const enrolled = appStarted && (i % 2 === 0) ? 1 : 0; // 50% of appStarted
  
  let stage = 'Inquiry';
  if (enrolled) stage = 'Enrolled';
  else if (appStarted) stage = 'Application Started';
  else if (diagnostic) stage = 'Diagnostic Completed';
  else if (connected) stage = 'Counselor Connected';
  
  const revenue = enrolled ? (product === 'Study Abroad' ? 45000 : 25000) : 0;
  
  csv += `LEAD-${String(i).padStart(4, '0')},Student_${i},${grade},${board},${product},${stage},${connected},${diagnostic},${appStarted},${enrolled},${revenue}\n`;
}

const dir = path.join(process.cwd(), 'data', 'samples');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'meetuniversity_sales_pipeline.csv'), csv);
console.log('Regenerated 1000 row CSV with independent distributions');
