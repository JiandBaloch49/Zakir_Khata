// Report templates for the book-level "⬇ PDF Report" download.
//
// MONEY: every {{...}} amount placeholder is filled with formatCurrency(paisa),
// which already emits the "Rs." prefix. Templates must therefore NOT add their own
// literal "Rs " prefix, or output reads "Rs Rs. 1,234.56".

const BASE_STYLE = `
    body { font-family: sans-serif; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
    .header h1 { margin: 0; }
    .header p { margin: 5px 0; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    td.num, th.num { text-align: right; }
    .empty { text-align: center; color: #888; font-style: italic; }
    .summary { border: 1px solid #ddd; padding: 15px; background: #fafafa; }
    .summary p { margin: 5px 0; }
`;

export const CASH_RECEIPT_TEMPLATE = `
<html>
<head>
  <style>
    ${BASE_STYLE}
    .header h1 { color: #FF6B35; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{business_name}}</h1>
    <p>{{business_address}}</p>
  </div>
  <h2>Cash Book Statement</h2>
  <p>Period: {{period}}</p>
  <table>
    <tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th class="num">Amount</th></tr>
    {{rows}}
  </table>
  <div class="summary">
    <p>Total IN: <strong>{{totalIn}}</strong></p>
    <p>Total OUT: <strong>{{totalOut}}</strong></p>
    <p>Net Balance: <strong>{{netBalance}}</strong></p>
  </div>
</body>
</html>
`;

export const EXPENSE_REPORT_TEMPLATE = `
<html>
<head>
  <style>
    ${BASE_STYLE}
    .header h1 { color: #EF4444; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{business_name}}</h1>
    <p>Expense Report</p>
  </div>
  <p>Period: {{period}}</p>
  <table>
    <tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th></tr>
    {{rows}}
  </table>
  <div class="summary">
    <p>Total Expenses: <strong>{{total}}</strong></p>
  </div>
</body>
</html>
`;

export const STOCK_REPORT_TEMPLATE = `
<html>
<head>
  <style>
    ${BASE_STYLE}
    .header h1 { color: #F59E0B; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{business_name}}</h1>
    <p>Stock Report</p>
  </div>
  <p>Period: {{period}}</p>
  <table>
    <tr><th>Item Name</th><th>Location</th><th class="num">Stock IN</th><th class="num">Stock OUT</th><th class="num">Net Qty</th><th class="num">IN Value</th><th class="num">OUT Value</th></tr>
    {{rows}}
  </table>
  <div class="summary">
    <p>Total Purchase Value (IN): <strong>{{totalInValue}}</strong></p>
    <p>Total Sale Value (OUT): <strong>{{totalOutValue}}</strong></p>
  </div>
</body>
</html>
`;

// Stock IN / Stock OUT: one movement per row — the same rows the report screens list.
// {{direction}} is "IN" or "OUT" so the document is unmistakably one or the other.
export const STOCK_MOVEMENT_TEMPLATE = `
<html>
<head>
  <style>
    ${BASE_STYLE}
    .header h1 { color: #F59E0B; }
    .in { color: #16A34A; } .out { color: #DC2626; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{business_name}}</h1>
    <p>Stock {{direction}} Report</p>
  </div>
  <p>Period: {{period}}</p>
  <table>
    <tr><th>Item</th><th>Date</th><th class="num">Qty {{direction}}</th><th class="num">Rate</th><th class="num">Amount</th></tr>
    {{rows}}
  </table>
  <div class="summary">
    <p>Entries: <strong>{{entries}}</strong></p>
    <p>Total Qty {{direction}}: <strong>{{totalQty}}</strong></p>
    <p>Total Amount ({{amountLabel}}): <strong>{{totalAmount}}</strong></p>
  </div>
</body>
</html>
`;

export const BILL_REPORT_TEMPLATE = `
<html>
<head>
  <style>
    ${BASE_STYLE}
    .header h1 { color: #FF6B35; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{business_name}}</h1>
    <p>Bill Book Report</p>
  </div>
  <p>Period: {{period}}</p>
  <table>
    <tr><th>Bill #</th><th>Date</th><th>Customer</th><th>Status</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Due</th></tr>
    {{rows}}
  </table>
  <div class="summary">
    <p>Total Bills: <strong>{{billCount}}</strong></p>
    <p>Total Billed: <strong>{{totalBilled}}</strong></p>
    <p>Total Received: <strong>{{totalPaid}}</strong></p>
    <p>Total Outstanding: <strong>{{totalDue}}</strong></p>
  </div>
</body>
</html>
`;

// Staff is a roster, not period data — it shows an "As of" date, not a period.
export const STAFF_REPORT_TEMPLATE = `
<html>
<head>
  <style>
    ${BASE_STYLE}
    .header h1 { color: #6c5ce7; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{business_name}}</h1>
    <p>Staff Report</p>
  </div>
  <p>As of {{asOfDate}}</p>
  <table>
    <tr><th>Name</th><th>Role</th><th>Phone</th><th>Area</th><th>Joined</th><th>Status</th><th class="num">Monthly Salary</th></tr>
    {{rows}}
  </table>
  <div class="summary">
    <p>Total Staff: <strong>{{totalStaff}}</strong></p>
    <p>Active: <strong>{{activeStaff}}</strong></p>
    <p>Total Monthly Salary: <strong>{{totalMonthlySalary}}</strong></p>
  </div>
</body>
</html>
`;
