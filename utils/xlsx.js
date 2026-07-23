function stringToUtf8Bytes(text) {
  const encoded = unescape(encodeURIComponent(String(text)));
  const bytes = [];
  for (let i = 0; i < encoded.length; i += 1) {
    bytes.push(encoded.charCodeAt(i));
  }
  return bytes;
}

function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pushUInt16(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUInt32(bytes, value) {
  bytes.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function escapeXml(value) {
  return String(value === undefined || value === null || value === "" ? "—" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

function normalizeCell(value) {
  return String(value === undefined || value === null || value === "" ? "—" : value);
}

function buildSharedStrings(rows) {
  const map = {};
  const values = [];
  let count = 0;
  rows.forEach((row) => {
    row.forEach((cell) => {
      const text = normalizeCell(cell);
      count += 1;
      if (map[text] === undefined) {
        map[text] = values.length;
        values.push(text);
      }
    });
  });
  const items = values.map((text) => `<si><t>${escapeXml(text)}</t></si>`).join("");
  return {
    map,
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${count}" uniqueCount="${values.length}">
  ${items}
</sst>`
  };
}

function buildSheetXml(rows, sharedStringMap) {
  const rowCount = Math.max(rows.length, 1);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 1);
  const dimensionRef = `A1:${columnName(columnCount - 1)}${rowCount}`;
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((cell, cellIndex) => {
      const ref = columnName(cellIndex) + (rowIndex + 1);
      const sharedIndex = sharedStringMap[normalizeCell(cell)];
      return `<c r="${ref}" t="s"><v>${sharedIndex}</v></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}"/>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function buildZip(files) {
  const output = [];
  const central = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = stringToUtf8Bytes(file.name);
    const contentBytes = stringToUtf8Bytes(file.content);
    const crc = crc32(contentBytes);

    pushUInt32(output, 0x04034b50);
    pushUInt16(output, 20);
    pushUInt16(output, 0x0800);
    pushUInt16(output, 0);
    pushUInt16(output, 0);
    pushUInt16(output, 0);
    pushUInt32(output, crc);
    pushUInt32(output, contentBytes.length);
    pushUInt32(output, contentBytes.length);
    pushUInt16(output, nameBytes.length);
    pushUInt16(output, 0);
    output.push.apply(output, nameBytes);
    output.push.apply(output, contentBytes);

    pushUInt32(central, 0x02014b50);
    pushUInt16(central, 20);
    pushUInt16(central, 20);
    pushUInt16(central, 0x0800);
    pushUInt16(central, 0);
    pushUInt16(central, 0);
    pushUInt16(central, 0);
    pushUInt32(central, crc);
    pushUInt32(central, contentBytes.length);
    pushUInt32(central, contentBytes.length);
    pushUInt16(central, nameBytes.length);
    pushUInt16(central, 0);
    pushUInt16(central, 0);
    pushUInt16(central, 0);
    pushUInt16(central, 0);
    pushUInt32(central, 0);
    pushUInt32(central, offset);
    central.push.apply(central, nameBytes);

    offset = output.length;
  });

  const centralOffset = output.length;
  output.push.apply(output, central);
  pushUInt32(output, 0x06054b50);
  pushUInt16(output, 0);
  pushUInt16(output, 0);
  pushUInt16(output, files.length);
  pushUInt16(output, files.length);
  pushUInt32(output, central.length);
  pushUInt32(output, centralOffset);
  pushUInt16(output, 0);

  return new Uint8Array(output).buffer;
}

function createWorkbook(rows) {
  const sharedStrings = buildSharedStrings(rows);
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="导出数据" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`
    },
    {
      name: "xl/sharedStrings.xml",
      content: sharedStrings.xml
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: buildSheetXml(rows, sharedStrings.map)
    }
  ];
  return buildZip(files);
}

module.exports = {
  createWorkbook
};
