export interface PurchaseHeader {
  po: string;
  orderDate: Date | null;
  purchaser: string;
  supplier: string;
  vendorShipmentNo: string;
}

export interface PurchaseLine {
  po: string;
  line: number;
  sku: string;
  destination: string;
  pgrd: Date | null;
  egrd: Date | null;
  qty: number;
  cqty: number;
  asd: Date | null;   // Actual Shipping Date
  esd: Date | null;   // Expected Shipping Date (col 6 in default / col 36 in extended) — for SOT calc
  edd: Date | null;   // Expected Delivery Date from Shiptify (col 17 in default / col 33 in extended) — empty = not booked
  status: string;
  confirmedStatus: string;
  lossReasonCode: string;
  supplier: string;
  vendorCode: string; // BC "Buy-from Vendor No." — used to look up China-origin via Airtable vendor mapping
  purchaser: string;
  orderDate: Date | null;
}

