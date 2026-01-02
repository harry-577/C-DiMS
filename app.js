/* ============================================================
   Drugs Inventory Management System - app.js
   Version 1.1.0 (Dark Mode + Backup/Restore)
   ============================================================ */

let db;

// MASTER PIN (fixed override)
const MASTER_PIN = "9999";

// Local storage keys
const PIN_STORAGE_KEY = "drugs_inventory_increment_pin";
const THEME_STORAGE_KEY = "drugs_inventory_theme";

// Default PIN
const DEFAULT_PIN = "4321";

// IndexedDB constants
const DB_NAME = "drugs_inventory_db";
const DB_VERSION = 3;

let reportCurrentSort = "date-desc";

/* ============================================================
   PIN HELPERS
   ============================================================ */
function getCurrentPin() {
  return localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
}

function setCurrentPin(newPin) {
  localStorage.setItem(PIN_STORAGE_KEY, newPin);
}

/* ============================================================
   THEME (DARK/LIGHT MODE)
   ============================================================ */
function applyTheme(theme) {
  const html = document.documentElement;
  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-label");

  if (theme === "dark") {
    html.classList.add("dark");
    icon.textContent = "🌙";
    label.textContent = "Dark";
  } else {
    html.classList.remove("dark");
    icon.textContent = "🌞";
    label.textContent = "Light";
  }

  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function initThemeToggle() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
  applyTheme(savedTheme);

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const current = localStorage.getItem(THEME_STORAGE_KEY) || "light";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
  });
}

/* ============================================================
   INDEXEDDB SETUP
   ============================================================ */
// function openDatabase() {
//   return new Promise((resolve, reject) => {
//     const request = indexedDB.open(DB_NAME, DB_VERSION);

//     request.onupgradeneeded = (event) => {
//       const db = event.target.result;

//       if (!db.objectStoreNames.contains("drugs")) {
//         const drugStore = db.createObjectStore("drugs", {
//           keyPath: "id",
//           autoIncrement: true,
//         });
//         drugStore.createIndex("name", "name", { unique: false });
//       }

//       if (!db.objectStoreNames.contains("dispenses")) {
//         const dispStore = db.createObjectStore("dispenses", {
//           keyPath: "id",
//           autoIncrement: true,
//         });
//         dispStore.createIndex("dateDispensed", "dateDispensed", {
//           unique: false,
//         });
//       }

//       if (!db.objectStoreNames.contains("settings")) {
//     db.createObjectStore("settings", { keyPath: "key" });
//   }
//     };

//     request.onsuccess = (event) => {
//       db = event.target.result;
//       console.log("DB opened:", db);
//       resolve(db);
//     };

//     request.onerror = (event) => reject(event.target.error);
//   });
// }

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("drugs")) {
        db.createObjectStore("drugs", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("dispenses")) {
        db.createObjectStore("dispenses", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;

      // ⭐ Wait for the database to finish any pending operations
      db.onversionchange = () => db.close();

      // ⭐ Ensure the connection is fully ready
      if (db.objectStoreNames.contains("settings")) {
        resolve(db);
      } else {
        reject("Settings store missing after open");
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/* ============================================================
   REQUEST PERSISTENT STORAGE (GLOBAL)
   ============================================================ */
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then((isPersisted) => {
    console.log("Already persisted?", isPersisted);
    if (!isPersisted) {
      navigator.storage.persist().then((granted) => {
        console.log("Persistent storage granted?", granted);
        if (granted) {
          console.log("Your IndexedDB data is now protected from eviction.");
        } else {
          console.log("Browser denied persistent storage request.");
        }
      });
    }
  });
}


/* ============================================================
   Date formatting helper (dd/mm/yyyy) 12 Dec
   ============================================================ */
function formatDateDDMMYYYY(date) {
  if (!(date instanceof Date) || isNaN(date)) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}


/* ============================================================
   DRUG HELPERS
   ============================================================ */
function saveDrug(drug) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drugs", "readwrite");
    const store = tx.objectStore("drugs");

    const now = new Date().toISOString();
    drug.updatedAt = now;
    if (!drug.createdAt) drug.createdAt = now;

    const request = store.put(drug);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getAllDrugs() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drugs", "readonly");
    const store = tx.objectStore("drugs");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteDrug(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drugs", "readwrite");
    const store = tx.objectStore("drugs");
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}


/* ============================================================
   DISPENSE HELPERS
   ============================================================ */
function saveDispense(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("dispenses", "readwrite");
    const store = tx.objectStore("dispenses");
    const request = store.add(record);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getAllDispenses() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("dispenses", "readonly");
    const store = tx.objectStore("dispenses");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getRecentDispenses(limit = 20) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("dispenses", "readonly");
    const store = tx.objectStore("dispenses");
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result
        .sort((a, b) => new Date(b.dateDispensed) - new Date(a.dateDispensed))
        .slice(0, limit);
      resolve(results);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

/* ============================================================
   DISPENSE DELETE LOGIC (with Authorization Code)
   ============================================================ */
function initDispenseDeleteModal() {
  // 🟢 Grab modal + elements by their unique IDs (specific to dispense modal)
  const modal = document.getElementById("dispense-delete-modal");
  const cancelBtn = document.getElementById("dispense-delete-cancel");
  const confirmBtn = document.getElementById("dispense-delete-confirm");
  const pinInput = document.getElementById("dispense-delete-pin");
  const drugNameSpan = document.getElementById("dispense-delete-drug-name");

  // 🟢 Track which record is being targeted
  let targetId = null;
  let targetDrugName = "";

  /* ============================================================
     LISTEN FOR DELETE BUTTON CLICKS IN TABLE ROWS
     === */
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-dispense-btn")) {
      // Get the record ID and drug name from the button’s data attributes
      targetId = Number(e.target.dataset.id);
      targetDrugName = e.target.dataset.name || "";

      // Show the drug name in the modal
      drugNameSpan.textContent = targetDrugName;

      // Clear any previous PIN input
      pinInput.value = "";

      // Show the modal
      modal.classList.remove("hidden");
    }
  });

  /* ============================================================
     CANCEL BUTTON HANDLER
     ==== */
  cancelBtn.addEventListener("click", () => {
    // Hide modal
    modal.classList.add("hidden");

    // Reset state
    targetId = null;
    targetDrugName = "";
    pinInput.value = "";
  });

  /* ============================================================
     CONFIRM DELETE HANDLER (requires PIN)
     ==== */
  confirmBtn.addEventListener("click", async () => {
    const enteredPin = pinInput.value.trim();

    // Replace getCurrentPin() with your actual PIN retrieval logic
    const existingPin = getCurrentPin();
    const MASTER_PIN = "1234"; // define globally or replace with your master PIN

    // 🟢 Validate PIN
    if (!enteredPin) {
      alert("Please enter the authorization code.");
      return;
    }
    if (!(enteredPin === existingPin || enteredPin === MASTER_PIN)) {
      alert("Authorization code is incorrect.");
      return;
    }

    // 🟢 Perform deletion if PIN is valid
    if (targetId) {
      await deleteDispense(targetId);      // delete from IndexedDB
      await refreshDispenseTable();        // refresh table
      modal.classList.add("hidden");       // hide modal
      pinInput.value = "";                 // clear PIN after success

      // Show success modal (reuse inventory’s success modal)
      document.getElementById("success-delete-modal").classList.remove("hidden");
    }
  });
}

/* ============================================================
   DELETE DISPENSE RECORD HELPER
   ============================================================ */
async function deleteDispense(id) {
  const tx = db.transaction("dispenses", "readwrite");
  const store = tx.objectStore("dispenses");
  await store.delete(id);
}

/* ============================================================
   SUCCESS DELETE MODAL HANDLER
   ============================================================ */
function initSuccessDeleteModal() {
  const successModal = document.getElementById("success-delete-modal");
  const okBtn = document.getElementById("success-delete-ok");

  if (successModal && okBtn) {
    okBtn.addEventListener("click", () => {
      successModal.classList.add("hidden");
    });
  }
}



/* ============================================================
   TAB NAVIGATION
   ============================================================ */
function initTabs() {
  const tabs = {
    inventory: document.getElementById("tab-inventory"),
    dispense: document.getElementById("tab-dispense"),
    reports: document.getElementById("tab-reports"),
    settings: document.getElementById("tab-settings"),
    about: document.getElementById("tab-about"),
    help: document.getElementById("tab-help"),
  };

  const sections = {
    inventory: document.getElementById("section-inventory"),
    dispense: document.getElementById("section-dispense"),
    reports: document.getElementById("section-reports"),
    settings: document.getElementById("section-settings"),
    about: document.getElementById("section-about"),
    help: document.getElementById("section-help"),
  };

  function resetTabs() {
    Object.values(tabs).forEach(
      (btn) =>
        (btn.className =
          "flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-800 dark:text-gray-100 rounded text-center")
    );
  }

  function showSection(name) {
    Object.values(sections).forEach((sec) => sec.classList.add("hidden"));
    sections[name].classList.remove("hidden");

    resetTabs();
    tabs[name].className =
      "flex-1 px-4 py-2 bg-primary text-white rounded text-center";
  }

  Object.entries(tabs).forEach(([name, btn]) => {
    btn.addEventListener("click", () => showSection(name));
  });

  showSection("inventory");
}

// /* ============================================================
//    INVENTORY
//    ============================================================ */
// function initInventory() {
//   const form = document.getElementById("drug-form");
//   const expiryInput = document.getElementById("drug-expiry");

//   form.addEventListener("submit", async (e) => {
//     e.preventDefault();

//     const id = document.getElementById("drug-id").value;
//     const name = document.getElementById("drug-name").value.trim();
//     const classification = document
//       .getElementById("drug-classification")
//       .value.trim();
//     const subClass = document
//       .getElementById("drug-subClass")
//       .value.trim();

//     // Parse and format expiry date as dd/mm/yyyy
//     const inputValue = expiryInput.value; // e.g. "2025-11-27" if <input type="date">
//     const dateObj = new Date(inputValue);
//     const day = String(dateObj.getDate()).padStart(2, "0");
//     const month = String(dateObj.getMonth() + 1).padStart(2, "0");
//     const year = dateObj.getFullYear();
//     const expiry = `${day}/${month}/${year}`;

//     // Calculate days difference
//     const today = new Date();
//     const diffMs = dateObj - today;
//     const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

//     // Apply text color based on expiry status
//     if (diffDays < 0) {
//       // Expired
//       expiryInput.style.color = "red";
//     } else if (diffDays <= 5) {
//       // Within 5 days
//       expiryInput.style.color = "orange";
//     } else {
//       // Safe → reset to default theme color
//       expiryInput.style.color = "";
//     }

//     const unit = document.getElementById("drug-unit").value.trim();
//     const quantity = Number(
//       document.getElementById("drug-quantity").value
//     );
//     const criticalLevel = Number(
//       document.getElementById("drug-critical").value || 0
//     );

//     if (!name || quantity < 0) {
//       alert("Please enter a valid name and quantity.");
//       return;
//     }

//     let drug = {
//       name,
//       classification,
//       subClass,
//       expiry,   // always dd/mm/yyyy
//       unit,
//       quantity,
//       criticalLevel,
//     };

//     if (id) drug.id = Number(id);

//     await saveDrug(drug);
//     form.reset();
//     document.getElementById("drug-id").value = "";

//     await refreshInventoryTable();
//     await refreshDispenseDrugOptions();
//   });

//   document
//     .getElementById("search-name")
//     .addEventListener("input", refreshInventoryTable);
//   document
//     .getElementById("search-classification")
//     .addEventListener("input", refreshInventoryTable);
//   document
//     .getElementById("search-critical")
//     .addEventListener("change", refreshInventoryTable);

//   refreshInventoryTable();
// }

// async function refreshInventoryTable() {
//   const tbody = document.getElementById("inventory-table-body");
//   tbody.innerHTML = "";

//   const nameFilter = document
//     .getElementById("search-name")
//     .value.toLowerCase();
//   const classFilter = document
//     .getElementById("search-classification")
//     .value.toLowerCase();
//   const criticalFilter = document.getElementById("search-critical").value;

//   let drugs = await getAllDrugs();

//   // Alphabetical ordering
//   drugs.sort((a, b) => a.name.localeCompare(b.name));

//   // Filtering
//   drugs = drugs.filter((d) => {
//     const matchesName = d.name.toLowerCase().includes(nameFilter);
//     const matchesClass = d.classification
//       .toLowerCase()
//       .includes(classFilter);
//     let matchesCritical = true;

//     if (criticalFilter === "critical") {
//       matchesCritical = d.quantity <= (d.criticalLevel || 0);
//     }

//     return matchesName && matchesClass && matchesCritical;
//   });

//   // Serial numbering
//   let sn = 1;

//   drugs.forEach((drug) => {
//     const tr = document.createElement("tr");

//     const isCritical = drug.quantity <= (drug.criticalLevel || 0);
//     const statusText = isCritical ? "Critical" : "OK";
//     const statusClass = isCritical
//       ? "text-red-600 font-semibold"
//       : "text-green-600";

//     // Color coding for expiry in table
//     let expiryClass = "";
//     if (drug.expiry && drug.expiry !== "-") {
//       const [day, month, year] = drug.expiry.split("/");
//       const dateObj = new Date(year, month - 1, day);
//       const today = new Date();
//       const diffMs = dateObj - today;
//       const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

//       if (diffDays < 0) {
//         // Expired
//         expiryClass = "text-red-600 font-semibold";
//       } else if (diffDays <= 5) {
//         // Within 5 days
//         expiryClass = "text-orange-500 font-semibold";
//       } else {
//         // Safe expiry → always green
//         expiryClass = "text-green-600 font-semibold";
//       }
//     }

//     tr.innerHTML = `
//       <td class="px-2 py-1">${sn++}</td>
//       <td class="px-2 py-1">${drug.name}</td>
//       <td class="px-2 py-1">${drug.classification || "-"}</td>
//       <td class="px-2 py-1">${drug.subClass || "-"}</td>
//       <td class="px-2 py-1 ${expiryClass}">${drug.expiry || "-"}</td>
//       <td class="px-2 py-1">${drug.unit || "-"}</td>
//       <td class="px-2 py-1">${drug.quantity}</td>
//       <td class="px-2 py-1">${drug.criticalLevel || 0}</td>
//       <td class="px-2 py-1 ${statusClass}">${statusText}</td>
//       <td class="px-2 py-1">
//         <button class="text-primary text-xs mr-4" data-action="edit" data-id="${
//           drug.id
//         }">Edit</button>
//         <button class="text-green-600 text-xs font-bold" data-action="increment" data-id="${
//           drug.id
//         }">Add Stock</button>
//         <button class="text-red-600 text-xs ml-4" data-action="delete" data-id="${
//           drug.id
//         }">Delete entry</button>

//       </td>
//     `;

//     tbody.appendChild(tr);
//   });

//   // Edit button handlers
//   tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
//     btn.addEventListener("click", async () => {
//       const id = Number(btn.getAttribute("data-id"));
//       const drugs = await getAllDrugs();
//       const drug = drugs.find((d) => d.id === id);
//       if (!drug) return;

//       document.getElementById("drug-id").value = drug.id;
//       document.getElementById("drug-name").value = drug.name;
//       document.getElementById("drug-classification").value =
//         drug.classification;
//       document.getElementById("drug-subClass").value =
//         drug.subClass;
//       // Convert dd/mm/yyyy back to yyyy-mm-dd for <input type="date">
//     if (drug.expiry && drug.expiry.includes("/")) {
//       const [day, month, year] = drug.expiry.split("/");
//       document.getElementById("drug-expiry").value =
//         `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
//     } else {
//       document.getElementById("drug-expiry").value = drug.expiry || "";
//     }
//       document.getElementById("drug-unit").value = drug.unit;
//       document.getElementById("drug-quantity").value = drug.quantity;
//       document.getElementById("drug-critical").value =
//         drug.criticalLevel || 0;

//       window.scrollTo({ top: 0, behavior: "smooth" });
//     });
//   });
// }

/* ============================================================
   INVENTORY
   ============================================================ */

  //  +++++++++ Inventory Pagination Inserts by H++++++++++

  /* ==++++++
   INVENTORY PAGINATION (GLOBAL STATE)
   ==++++++ */
let inventoryCurrentPage = 1;        // current page index (1-based)
let inventoryPageSize = 10;          // rows per page (default matches HTML: 10)
let inventoryTotalPages = 1;         // total pages after filtering
let inventoryFilteredData = [];      // holds filtered + sorted drugs for current view

/* ===++++++
   INVENTORY PAGINATION HELPERS
   ===++++++ */

/* ============================================================
   INVENTORY SMART PAGINATION BUILDER
   ============================================================ */
function updateInventoryPaginationUI() {
  const pageNumbersDiv = document.getElementById("inventory-page-numbers");
  pageNumbersDiv.innerHTML = "";

  const total = inventoryTotalPages;
  const current = inventoryCurrentPage;

  // ✅ Page X of Y label
  const label = document.createElement("span");
  // label.textContent = `Page ${current} of ${total}`;
  // label.classList.add("mx-2");
  pageNumbersDiv.appendChild(label);

  // If only 1 page, no need to render anything else
  if (total <= 1) return;

  // Helper to create a page button
  const createBtn = (page, isActive = false) => {
    const btn = document.createElement("button");
    btn.textContent = page;
    btn.className =
      "px-2 py-1 border rounded text-sm " +
      (isActive
        ? "bg-blue-600 text-white font-semibold"
        : "bg-gray-100 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600");

    btn.addEventListener("click", () => {
      inventoryCurrentPage = page;
      refreshInventoryTable();
    });

    return btn;
  };

  // Helper to create ellipsis
  const createEllipsis = () => {
    const span = document.createElement("span");
    span.textContent = "…";
    span.className = "px-2 text-gray-500";
    return span;
  };

  /* ============================================================
     ALWAYS SHOW FIRST PAGE
     ==== */
  pageNumbersDiv.appendChild(createBtn(1, current === 1));

  /* ============================================================
     LEFT ELLIPSIS (if needed)
     ==== */
  if (current > 3) {
    pageNumbersDiv.appendChild(createEllipsis());
  }

  /* ============================================================
     CURRENT PAGE ±1
     ===== */
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let p = start; p <= end; p++) {
    pageNumbersDiv.appendChild(createBtn(p, p === current));
  }

  /* ============================================================
     RIGHT ELLIPSIS (if needed)
     ===== */
  if (current < total - 2) {
    pageNumbersDiv.appendChild(createEllipsis());
  }

  /* ============================================================
     ALWAYS SHOW LAST PAGE
     ==== */
  if (total > 1) {
    pageNumbersDiv.appendChild(createBtn(total, current === total));
  }

  // ✅ Enable/disable Prev/Next buttons
  document.getElementById("inventory-prev-page").disabled = current === 1;
  document.getElementById("inventory-next-page").disabled = current === total;
}

// ++++++++++++++++++++++++++++

/* ============================================================
   INVENTORY INITIALIZATION
   ============================================================ */
function initInventory() {
  // // 🟢 Request persistent storage to protect IndexedDB data
  // if (navigator.storage && navigator.storage.persist) {
  //   navigator.storage.persisted().then((isPersisted) => {
  //     console.log("Already persisted?", isPersisted);
  //     if (!isPersisted) {
  //       navigator.storage.persist().then((granted) => {
  //         console.log("Persistent storage granted?", granted);
  //         if (granted) {
  //           console.log("Your IndexedDB data is now protected from eviction.");
  //         } else {
  //           console.log("Browser denied persistent storage request.");
  //         }
  //       });
  //     }
  //   });
  // }


  const form = document.getElementById("drug-form");
  const expiryInput = document.getElementById("drug-expiry");

  // 🟢 Unit select + Other input references
  const unitSelect = document.getElementById("drug-unit");
  const unitText = document.getElementById("drug-unit-text");

  // 🟢 Toggle text input when "Other" is chosen
  unitSelect.addEventListener("change", () => {
    if (unitSelect.value === "Other") {
      unitText.classList.remove("hidden");
    } else {
      unitText.classList.add("hidden");
      unitText.value = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("drug-id").value;
    const name = document.getElementById("drug-name").value.trim();
    const classification = document.getElementById("drug-classification").value.trim();
    const subClass = document.getElementById("drug-subClass").value.trim();

    // Parse and format expiry date as dd/mm/yyyy
    const inputValue = expiryInput.value;
    const dateObj = new Date(inputValue);
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const year = dateObj.getFullYear();
    const expiry = `${day}/${month}/${year}`;

    // Expiry color coding in form
    const today = new Date();
    const diffMs = dateObj - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      expiryInput.style.color = "red";
    } else if (diffDays <= 5) {
      expiryInput.style.color = "orange";
    } else {
      expiryInput.style.color = "";
    }

    const packSize = document.getElementById("pack-size").value.trim();

    // 🟢 Use select value or manual text if "Other"
    const unit = unitSelect.value === "Other" ? unitText.value.trim() : unitSelect.value;

    const quantity = Number(document.getElementById("drug-quantity").value);
    const criticalLevel = Number(document.getElementById("drug-critical").value || 0);

    if (!name || quantity < 0) {
      alert("Please enter a valid name and quantity.");
      return;
    }

    let drug = {
      name,
      classification,
      subClass,
      expiry,
      packSize,
      unit,
      quantity,
      criticalLevel,
    };

    if (id) {
      drug.id = Number(id);

      // Show custom overwrite confirmation modal
      document.getElementById("edit-confirm-drug-name").textContent = drug.name;
      const confirmModal = document.getElementById("edit-confirm-modal");
      confirmModal.classList.remove("hidden");

      const cancelBtn = document.getElementById("edit-confirm-cancel");
      const okBtn = document.getElementById("edit-confirm-ok");

      const cleanup = () => {
        confirmModal.classList.add("hidden");
        cancelBtn.removeEventListener("click", onCancel);
        okBtn.removeEventListener("click", onOk);
      };

      const onCancel = () => cleanup();
      const onOk = async () => {
        cleanup();

        // Perform the save
        await saveDrug(drug);
        form.reset();
        document.getElementById("drug-id").value = "";
        await refreshInventoryTable();
        await refreshDispenseDrugOptions();

        // 🟢 Show success modal after edit completes
        const successModal = document.getElementById("success-edit-modal");
        successModal.classList.remove("hidden");

        const successOkBtn = document.getElementById("success-edit-ok");
        const closeSuccess = () => {
          successModal.classList.add("hidden");
          successOkBtn.removeEventListener("click", closeSuccess);
        };
        successOkBtn.addEventListener("click", closeSuccess);
      };

      cancelBtn.addEventListener("click", onCancel);
      okBtn.addEventListener("click", onOk);

      return; // stop here until modal resolves
    }

    // New entry (no id) → save immediately
    await saveDrug(drug);
    form.reset();
    document.getElementById("drug-id").value = "";

    await refreshInventoryTable();
    await refreshDispenseDrugOptions();
  });

  // Search filters
  document.getElementById("search-name").addEventListener("input", () => {
    inventoryCurrentPage = 1; // ✅ reset page when filtering
    refreshInventoryTable();
  });

  document.getElementById("search-classification").addEventListener("input", () => {
    inventoryCurrentPage = 1; // ✅ reset page when filtering
    refreshInventoryTable();
  });

  document.getElementById("status-filter").addEventListener("change", () => {
    inventoryCurrentPage = 1; // ✅ reset page when filtering
    refreshInventoryTable();
  });

  /* ====+++++++
     ✅ PAGINATION EVENT LISTENERS
     ====+++++++ */

  // Rows per page
  document.getElementById("inventory-page-size").addEventListener("change", (e) => {
    inventoryPageSize = Number(e.target.value);
    inventoryCurrentPage = 1; // reset to first page
    refreshInventoryTable();
  });

  // Prev page
  document.getElementById("inventory-prev-page").addEventListener("click", () => {
    if (inventoryCurrentPage > 1) {
      inventoryCurrentPage--;
      refreshInventoryTable();
    }
  });

  // Next page
  document.getElementById("inventory-next-page").addEventListener("click", () => {
    if (inventoryCurrentPage < inventoryTotalPages) {
      inventoryCurrentPage++;
      refreshInventoryTable();
    }
  });

  // Initial load
  refreshInventoryTable();

  // Event Listener
  document
  .getElementById("btn-export-inventory-pdf")
  .addEventListener("click", exportInventoryToPDF);

}

/* ====
   REFRESH INVENTORY TABLE (WITH PAGINATION + NO RESULTS HANDLING)
   ===== */
async function refreshInventoryTable() {
  const tbody = document.getElementById("inventory-table-body");
  tbody.innerHTML = "";

  const nameFilter = document.getElementById("search-name").value.toLowerCase();
  const classFilter = document.getElementById("search-classification").value.toLowerCase();
  const statusFilter = document.getElementById("status-filter").value;

  let drugs = await getAllDrugs();

  // 🟢 Debug log: see what we got from IndexedDB
  console.log("refreshInventoryTable → raw drugs from DB:", drugs.length, drugs);

  // Alphabetical ordering
  drugs.sort((a, b) => a.name.localeCompare(b.name));

  // Filtering
  drugs = drugs.filter((d) => {
    const matchesName = d.name.toLowerCase().includes(nameFilter);
    const matchesClass = d.classification.toLowerCase().includes(classFilter);

    const isOut = d.quantity === 0;
    const isCritical = d.quantity > 0 && d.quantity <= (d.criticalLevel || 0);
    const isOk = d.quantity > (d.criticalLevel || 0);

    // Expiry check
    let isExpired = false;
    if (d.expiry && d.expiry.includes("/")) {
      const [day, month, year] = d.expiry.split("/");
      const dateObj = new Date(year, month - 1, day);
      const today = new Date();
      isExpired = dateObj < today;
    }

/* ============================================================
   STATUS FILTER HANDLING (extended options)
   ============================================================ */
let matchesStatus = true;

switch (statusFilter) {
  case "ok":
    matchesStatus = isOk;
    break;
  case "out":
    matchesStatus = isOut;
    break;
  case "critical":
    matchesStatus = isCritical;
    break;
  case "critical-ok":
    matchesStatus = isCritical || isOk;
    break;
  case "critical-out":
    matchesStatus = isCritical || isOut;
    break;
  case "expired":
    matchesStatus = isExpired;
    break;
  case "near-expiry":
    // near expiry means expiry within 5 days
    let isNearExpiry = false;
    if (d.expiry && d.expiry.includes("/")) {
      const [day, month, year] = d.expiry.split("/");
      const dateObj = new Date(year, month - 1, day);
      const today = new Date();
      const diffMs = dateObj - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isNearExpiry = diffDays > 0 && diffDays <= 5;
    }
    matchesStatus = isNearExpiry;
    break;
  case "near-expiry-expired":
    // combine near expiry + expired
    let isNear = false;
    if (d.expiry && d.expiry.includes("/")) {
      const [day, month, year] = d.expiry.split("/");
      const dateObj = new Date(year, month - 1, day);
      const today = new Date();
      const diffMs = dateObj - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isNear = diffDays > 0 && diffDays <= 5;
    }
    matchesStatus = isNear || isExpired;
    break;
  case "not-expired":
    matchesStatus = !isExpired;
    break;
  case "not-expired-ok":
    matchesStatus = !isExpired && isOk;
    break;
  case "near-expiry-ok":
    // near expiry OR ok
    let isNearOk = false;
    if (d.expiry && d.expiry.includes("/")) {
      const [day, month, year] = d.expiry.split("/");
      const dateObj = new Date(year, month - 1, day);
      const today = new Date();
      const diffMs = dateObj - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isNearOk = diffDays > 0 && diffDays <= 5;
    }
    matchesStatus = isNearOk || isOk;
    break;
  case "all":
  default:
    matchesStatus = true;
    break;
}


    return matchesName && matchesClass && matchesStatus;
  });

// 🟢 Debug log: after filtering
  console.log("refreshInventoryTable → after filters:", drugs.length, drugs);

  /* ====
     ✅ NO RESULTS HANDLING
     ==== */
  if (drugs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center py-4 text-gray-500">
          No matching records found.
        </td>
      </tr>
    `;
    inventoryFilteredData = [];
    inventoryTotalPages = 1;
    inventoryCurrentPage = 1;
    updateInventoryPaginationUI();
    return;
  }

  /* ======
     ✅ PAGINATION: STORE FILTERED RESULTS
     ====== */
  inventoryFilteredData = drugs;

  // Compute total pages
  inventoryTotalPages = Math.max(1, Math.ceil(inventoryFilteredData.length / inventoryPageSize));

  // Ensure current page is valid
  if (inventoryCurrentPage > inventoryTotalPages) {
    inventoryCurrentPage = inventoryTotalPages;
  }

  // Slice data for current page
  const startIndex = (inventoryCurrentPage - 1) * inventoryPageSize;
  const endIndex = startIndex + inventoryPageSize;
  const pageData = inventoryFilteredData.slice(startIndex, endIndex);

  /* ====
     ✅ TABLE RENDERING (NOW USING pageData)
     ==== */

  // Serial numbering (based on page)
  let sn = startIndex + 1;

  pageData.forEach((drug) => {
    const tr = document.createElement("tr");

    // Quantity status color coding
    let statusText, statusClass;

    if (drug.quantity === 0) {
      statusText = "OS";
      statusClass = "text-red-600 font-semibold";
    } else if (drug.quantity <= (drug.criticalLevel || 0)) {
      statusText = "Critical";
      statusClass = "text-orange-500 font-semibold";
    } else {
      statusText = "Ok";
      statusClass = "text-green-600 font-semibold";
    }

    // Expiry color coding
    let expiryClass = "";
    if (drug.expiry && drug.expiry.includes("/")) {
      const [day, month, year] = drug.expiry.split("/");
      const dateObj = new Date(year, month - 1, day);
      const today = new Date();
      const diffMs = dateObj - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        expiryClass = "text-red-600 font-semibold";
      } else if (diffDays <= 5) {
        expiryClass = "text-orange-500 font-semibold";
      } else {
        expiryClass = "text-green-600 font-semibold";
      }
    }

    // tr.innerHTML = `
    //   <td class="px-2 py-1">${sn++}</td>
    //   <td class="px-2 py-1">${drug.name}</td>
    //   <td class="px-2 py-1">${drug.classification || "-"}</td>
    //   <td class="px-2 py-1">${drug.subClass || "-"}</td>
    //   <td class="px-2 py-1 ${expiryClass}">${drug.expiry || "-"}</td>
    //   <td class="px-2 py-1">${drug.packSize || "-"}</td>
    //   <td class="px-2 py-1">${drug.unit || "-"}</td>
    //   <td class="px-2 py-1">${drug.quantity}</td>
    //   <td class="px-2 py-1">${drug.criticalLevel || 0}</td>
    //   <td class="px-2 py-1 ${statusClass}">${statusText}</td>
    //   <td class="px-2 py-1">


    //     <Div class="flex flex-row flex-nowrap gap-2">

    //     <!-- Edit button -->
    //     <button title="Edit entry" class="text-sm px-2 py-1 rounded text-blue-600 hover:bg-blue-700 hover:text-white transition-colors mr-1"
    //             data-action="edit" data-id="${drug.id}">
    //       <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    //         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
    //               d="M11 4h2m2-2l6 6-10 10H5v-4l10-10z" />
    //       </svg>
    //     </button>

    //     <!-- Add Stock button -->
    //     <button title="Add stock" class="text-sm px-2 py-1 rounded text-green-600 hover:bg-green-700 hover:text-white transition-colors font-bold"
    //             data-action="increment" data-id="${drug.id}">
    //       <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    //         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
    //               d="M12 4v16m8-8H4" />
    //       </svg>
    //     </button>

    //     <!-- Delete entry button -->
    //     <button title="Delete entry" class="text-sm px-2 py-1 text-red-600 hover:bg-red-700 hover:text-white transition-colors ml-1"
    //             data-action="delete" data-id="${drug.id}">
    //       <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    //         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
    //               d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3" />
    //       </svg>
    //     </button>
    //     </Div>

    //   </td>
    // `;

    tr.innerHTML = `
      <td class="px-2 py-1">${sn++}</td>
      <td class="px-2 py-1">${drug.name}</td>
      <td class="px-2 py-1">${drug.classification || "-"}</td>
      <td class="px-2 py-1">${drug.subClass || "-"}</td>
      <td class="px-2 py-1 ${expiryClass}">${drug.expiry || "-"}</td>
      <td class="px-2 py-1">${drug.packSize || "-"}</td>
      <td class="px-2 py-1">${drug.unit || "-"}</td>
      <td class="px-2 py-1">${drug.quantity}</td>
      <td class="px-2 py-1">${drug.criticalLevel || 0}</td>
      <td class="px-2 py-1 ${statusClass}">${statusText}</td>
      <td class="px-2 py-1">
        <div class="flex flex-row flex-nowrap gap-1 overflow-x-auto -mx-2 px-2">
          <!-- Edit button -->
          <button title="Edit entry"
            class="flex-shrink-0 text-sm px-2 py-1 rounded text-blue-600 hover:bg-blue-700 hover:text-white transition-colors mr-1"
            data-action="edit" data-id="${drug.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 4h2m2-2l6 6-10 10H5v-4l10-10z" />
            </svg>
          </button>

          <!-- Add Stock button -->
          <button title="Add stock"
            class="flex-shrink-0 text-sm px-2 py-1 rounded text-green-600 hover:bg-green-700 hover:text-white transition-colors font-bold"
            data-action="increment" data-id="${drug.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <!-- Delete entry button -->
          <button title="Delete entry"
            class="flex-shrink-0 text-sm px-2 py-1 text-red-600 hover:bg-red-700 hover:text-white transition-colors ml-1"
            data-action="delete" data-id="${drug.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3" />
            </svg>
          </button>
        </div>
      </td>
    `;


    tbody.appendChild(tr);
  });

  /* ===
     ✅ UPDATE PAGINATION UI
     === */
  updateInventoryPaginationUI();

  /* ===
     ✅ EDIT / DELETE / INCREMENT BUTTON HANDLERS
     === */

  // Edit buttons
  tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-id"));
      const drugs = await getAllDrugs();
      const drug = drugs.find((d) => d.id === id);
      if (!drug) return;

      document.getElementById("edit-modal-drug-name").textContent = drug.name;
      const modal = document.getElementById("edit-modal");
      modal.classList.remove("hidden");

      const cancelBtn = document.getElementById("edit-cancel");
      const confirmBtn = document.getElementById("edit-confirm");

      const cleanup = () => {
        modal.classList.add("hidden");
        cancelBtn.removeEventListener("click", onCancel);
        confirmBtn.removeEventListener("click", onConfirm);
        document.getElementById("edit-pin").value = "";
      };

      const onCancel = () => cleanup();
      const onConfirm = () => {
        const pin = document.getElementById("edit-pin").value;
        const currentPin = getCurrentPin();
        if (!(pin === currentPin || pin === MASTER_PIN)) {
          alert("Incorrect authorization code.");
          return;
        }

        // Populate form only after authorization
        document.getElementById("drug-id").value = drug.id;
        document.getElementById("drug-name").value = drug.name;
        document.getElementById("drug-classification").value = drug.classification;
        document.getElementById("drug-subClass").value = drug.subClass;

        if (drug.expiry && drug.expiry.includes("/")) {
          const [day, month, year] = drug.expiry.split("/");
          document.getElementById("drug-expiry").value =
            `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        } else {
          document.getElementById("drug-expiry").value = drug.expiry || "";
        }

        document.getElementById("drug-unit").value = drug.unit || "";
        document.getElementById("drug-quantity").value = drug.quantity;
        document.getElementById("drug-critical").value = drug.criticalLevel || 0;

        window.scrollTo({ top: 0, behavior: "smooth" });
        cleanup();
      };

      cancelBtn.addEventListener("click", onCancel);
      confirmBtn.addEventListener("click", onConfirm);
    });
  });
}


/* ============================================================
   EDIT ENTRY MODAL
   ============================================================ */
let editDrugId = null;

function initEditModal() {
  const modal = document.getElementById("edit-modal");
  const cancelBtn = document.getElementById("edit-cancel");
  const confirmBtn = document.getElementById("edit-confirm");

  if (!modal || !cancelBtn || !confirmBtn) {
    console.error("Edit modal elements not found in DOM.");
    return;
  }

  cancelBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    document.getElementById("edit-pin").value = "";
  });

  confirmBtn.addEventListener("click", async () => {
    const pin = document.getElementById("edit-pin").value;
    const currentPin = getCurrentPin();

    if (!(pin === currentPin || pin === MASTER_PIN)) {
      alert("Incorrect authorization code.");
      return;
    }

    const drugs = await getAllDrugs();
    const drug = drugs.find((d) => d.id === editDrugId);
    if (!drug) {
      alert("Drug not found.");
      return;
    }

    // ✅ Populate the form only after confirmation
    document.getElementById("drug-id").value = drug.id;
    document.getElementById("drug-name").value = drug.name;
    document.getElementById("drug-classification").value = drug.classification;
    document.getElementById("drug-subClass").value = drug.subClass;

    if (drug.expiry && drug.expiry.includes("/")) {
      const [day, month, year] = drug.expiry.split("/");
      document.getElementById("drug-expiry").value =
        `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    } else {
      document.getElementById("drug-expiry").value = drug.expiry || "";
    }

    // 🟢 Handle Unit dropdown + Other text field
    const unitSelect = document.getElementById("drug-unit");
    const unitText = document.getElementById("drug-unit-text");

    const standardUnits = ["mcg", "mg", "g", "mL", "L"];
    if (standardUnits.includes(drug.unit)) {
      unitSelect.value = drug.unit;
      unitText.classList.add("hidden");
      unitText.value = "";
    } else if (drug.unit) {
      unitSelect.value = "Other";
      unitText.classList.remove("hidden");
      unitText.value = drug.unit;
    } else {
      unitSelect.value = "";
      unitText.classList.add("hidden");
      unitText.value = "";
    }

    document.getElementById("drug-quantity").value = drug.quantity;
    document.getElementById("drug-critical").value = drug.criticalLevel || 0;

    modal.classList.add("hidden");
    document.getElementById("edit-pin").value = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='edit']");
    if (!btn) return;

    editDrugId = Number(btn.getAttribute("data-id"));
    const drugs = await getAllDrugs();
    const drug = drugs.find((d) => d.id === editDrugId);
    if (!drug) return;

    document.getElementById("edit-modal-drug-name").textContent = drug.name;
    modal.classList.remove("hidden");
  });
}



/* ============================================================
   INCREMENT STOCK MODAL
   ============================================================ */
let incrementDrugId = null;

function initIncrementModal() {
  const modal = document.getElementById("increment-modal");
  const cancelBtn = document.getElementById("increment-cancel");
  const confirmBtn = document.getElementById("increment-confirm");

  if (!modal || !cancelBtn || !confirmBtn) {
    console.error("Increment modal elements not found in DOM.");
    return;
  }

  cancelBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    document.getElementById("increment-pin").value = "";
    document.getElementById("increment-qty").value = "";
  });

  confirmBtn.addEventListener("click", async () => {
    const pin = document.getElementById("increment-pin").value;
    const currentPin = getCurrentPin();

    if (!(pin === currentPin || pin === MASTER_PIN)) {
      alert("Incorrect authorization code.");
      return;
    }

    const qty = Number(document.getElementById("increment-qty").value);
    if (qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const drugs = await getAllDrugs();
    const drug = drugs.find((d) => d.id === incrementDrugId);
    if (!drug) {
      alert("Drug not found.");
      return;
    }

    drug.quantity += qty;
    await saveDrug(drug);

    modal.classList.add("hidden");
    document.getElementById("increment-pin").value = "";
    document.getElementById("increment-qty").value = "";

    await refreshInventoryTable();
    await refreshDispenseDrugOptions();

    // 🟢 Show success modal
    const successModal = document.getElementById("success-increment-modal");
    successModal.classList.remove("hidden");
    const okBtn = document.getElementById("success-increment-ok");
    const closeSuccess = () => {
      successModal.classList.add("hidden");
      okBtn.removeEventListener("click", closeSuccess);
    };
    okBtn.addEventListener("click", closeSuccess);
  });

  // Event delegation for increment buttons
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='increment']");
    if (!btn) return;

    incrementDrugId = Number(btn.getAttribute("data-id"));
    const drugs = await getAllDrugs();
    const drug = drugs.find((d) => d.id === incrementDrugId);
    if (!drug) return;

    document.getElementById("modal-drug-name").textContent = drug.name;
    modal.classList.remove("hidden");
  });
}


/* ============================================================
   DELETE ENTRY MODAL
   ============================================================ */
let deleteDrugId = null;

function initDeleteModal() {
  const modal = document.getElementById("delete-modal");
  const cancelBtn = document.getElementById("delete-cancel");
  const confirmBtn = document.getElementById("delete-confirm");

  if (!modal || !cancelBtn || !confirmBtn) {
    console.error("Delete modal elements not found in DOM.");
    return;
  }

  cancelBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    document.getElementById("delete-pin").value = "";
  });

  confirmBtn.addEventListener("click", async () => {
    const pin = document.getElementById("delete-pin").value;
    const currentPin = getCurrentPin();

    if (!(pin === currentPin || pin === MASTER_PIN)) {
      alert("Incorrect authorization code.");
      return;
    }

    const drugs = await getAllDrugs();
    const drug = drugs.find((d) => d.id === deleteDrugId);
    if (!drug) {
      alert("Drug not found.");
      return;
    }

    // Proceed with deletion
    await deleteDrug(deleteDrugId);

    modal.classList.add("hidden");
    document.getElementById("delete-pin").value = "";

    await refreshInventoryTable();
    await refreshDispenseDrugOptions();

    // 🟢 Show success modal
    const successModal = document.getElementById("success-delete-modal");
    successModal.classList.remove("hidden");

    const okBtn = document.getElementById("success-delete-ok");
    const closeSuccess = () => {
      successModal.classList.add("hidden");
      okBtn.removeEventListener("click", closeSuccess);
    };
    okBtn.addEventListener("click", closeSuccess);
  });

  // Event delegation for delete buttons
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='delete']");
    if (!btn) return;

    deleteDrugId = Number(btn.getAttribute("data-id"));
    const drugs = await getAllDrugs();
    const drug = drugs.find((d) => d.id === deleteDrugId);
    if (!drug) return;

    document.getElementById("delete-drug-name").textContent = drug.name;
    modal.classList.remove("hidden");
  });
}


/* ============================================================
   GETTERS AND SETTERS for FACILITY NAME & PREPARED BY
   ============================================================ */
//   async function saveReportInfo(facilityName, preparedBy) {
//   const tx = db.transaction("settings", "readwrite");
//   const store = tx.objectStore("settings");
//   await store.put({ key: "facilityName", value: facilityName });
//   await store.put({ key: "preparedBy", value: preparedBy });
// }

// async function getReportInfo() {
//   const tx = db.transaction("settings", "readonly");
//   const store = tx.objectStore("settings");

//   const facilityNameReq = store.get("facilityName");
//   const preparedByReq = store.get("preparedBy");

//   const facilityName = (await facilityNameReq)?.value || "";
//   const preparedBy = (await preparedByReq)?.value || "";

//   return { facilityName, preparedBy };
// }

// Save facility name + prepared by
async function saveReportInfo(facilityName, preparedBy) {
  const tx = db.transaction("settings", "readwrite");
  const store = tx.objectStore("settings");
  await store.put({ key: "facilityName", value: facilityName });
  await store.put({ key: "preparedBy", value: preparedBy });
}

// Get saved facility name + prepared by
async function getReportInfo() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");

    const facilityNameReq = store.get("facilityName");
    const preparedByReq = store.get("preparedBy");

    let facilityName = "";
    let preparedBy = "";

    facilityNameReq.onsuccess = () => {
      facilityName = facilityNameReq.result?.value || "";
      preparedByReq.onsuccess = () => {
        preparedBy = preparedByReq.result?.value || "";
        resolve({ facilityName, preparedBy });
      };
      preparedByReq.onerror = () => reject(preparedByReq.error);
    };

    facilityNameReq.onerror = () => reject(facilityNameReq.error);
  });
}


// Load saved facility name + prepared by
async function loadReportInfoIntoSettings() {
  const { facilityName, preparedBy } = await getReportInfo();
  document.getElementById("settings-facility-name").value = facilityName;
  document.getElementById("settings-prepared-by").value = preparedBy;
}

// Call loader after DB is ready
// loadReportInfoIntoSettings();

/* ============================================================
   SETTINGS (PIN MANAGEMENT)
   ============================================================ */
function initSettings() {
  const currentPinInput = document.getElementById("settings-current-pin");
  const newPinInput = document.getElementById("settings-new-pin");
  const confirmPinInput = document.getElementById("settings-confirm-pin");
  const saveBtn = document.getElementById("settings-save-pin");

  saveBtn.addEventListener("click", () => {
    const currentPin = currentPinInput.value.trim();
    const newPin = newPinInput.value.trim();
    const confirmPin = confirmPinInput.value.trim();

    if (!currentPin || !newPin || !confirmPin) {
      alert("Please fill in all fields.");
      return;
    }

    if (newPin !== confirmPin) {
      alert("New PIN and confirmation do not match.");
      return;
    }

    const existingPin = getCurrentPin();

    if (!(currentPin === existingPin || currentPin === MASTER_PIN)) {
      alert("Current PIN or master PIN is incorrect.");
      return;
    }

    if (newPin.length < 4) {
      alert("Please use at least 4 digits for the new PIN.");
      return;
    }

    setCurrentPin(newPin);
    alert("PIN updated successfully.");

    currentPinInput.value = "";
    newPinInput.value = "";
    confirmPinInput.value = "";
  });
}
// +++====++++====++++ ++++==== 

// ++++++++++++++++++ DEC 18 starts ++++++++++++++++++++++++++


// /* ============================================================
//    EXPORT INVENTORY TO PDF (A4 LANDSCAPE, ALL FILTERED ROWS)
//    ============================================================ */
// async function exportInventoryToPDF() {
//   const { jsPDF } = window.jspdf || {};
//   if (!jsPDF) {
//     alert("jsPDF failed to load.");
//     return;
//   }

//   // ✅ Ensure we have the full filtered dataset
//   if (!inventoryFilteredData || inventoryFilteredData.length === 0) {
//     alert("No inventory data to export.");
//     return;
//   }

//   const doc = new jsPDF({
//     orientation: "landscape",
//     unit: "pt",
//     format: "a4",
//   });

//   /* ============================================================
//      HEADER: LOGO + APP NAME
//      ============================================================ */
//   const logoPath = "Resources/Dims 400 x 400.png";
//   doc.addImage(logoPath, "PNG", 40, 20, 40, 40);

//   doc.setFontSize(18);
//   doc.setFont(undefined, "bold");
//   doc.setTextColor(0, 0, 0);
//   doc.text("Cathy-D", 84, 47);
//   doc.setTextColor(0, 128, 0);
//   doc.text("i", 153, 47);
//   doc.setTextColor(0, 0, 0);
//   doc.text("MS", 158, 47);

//   // ✅ Get facility + prepared by
//   const { facilityName, preparedBy } = await getReportInfo();
//   console.log("Report Info for PDF:", facilityName, preparedBy);

//   // Facility Name under Cathy‑DiMS
//   doc.setFontSize(12);
//   doc.setFont(undefined, "normal");
//   if (facilityName) {
//     doc.text(facilityName, 84, 65); // aligned under Cathy‑DiMS
//   }

//   /* ============================================================
//      TITLE + DATE/TIME
//      ============================================================ */
//   doc.setFontSize(16);
//   doc.setFont(undefined, "normal");
//   doc.text("Inventory Report", 40, 80);

//   const now = new Date();
//   const datePrepared = `${String(now.getDate()).padStart(2, "0")}/${String(
//     now.getMonth() + 1
//   ).padStart(2, "0")}/${now.getFullYear()}`;
//   const timePrepared = now.toLocaleTimeString();

//   doc.setFontSize(10);
//   doc.text(`Date Prepared: ${datePrepared}`, 40, 100);
//   doc.text(`Time: ${timePrepared}`, 400, 100);

//   doc.text(`Prepared by: ${preparedBy || "—"}`, 40, 115);

//   /* ============================================================
//      TABLE HEADERS (skip Action column)
//      ============================================================ */
//   const headerCells = [
//     "S/N",
//     "Name",
//     "Classification",
//     "Subclass",
//     "Expiry",
//     "Pack Size",
//     "Unit",
//     "Qty",
//     "Critical",
//     "Status",
//   ];

//   /* ============================================================
//      BUILD BODY DATA FROM inventoryFilteredData
//      ============================================================ */
//   const bodyData = inventoryFilteredData.map((drug, index) => {
//     let statusText = "Ok";
//     if (drug.quantity === 0) statusText = "OS";
//     else if (drug.quantity <= (drug.criticalLevel || 0)) statusText = "Critical";

//     return [
//       String(index + 1),
//       drug.name || "-",
//       drug.classification || "-",
//       drug.subClass || "-",
//       drug.expiry || "-",
//       drug.packSize || "-",
//       drug.unit || "-",
//       String(drug.quantity),
//       String(drug.criticalLevel || 0),
//       statusText,
//     ];
//   });

//   /* ============================================================
//      COLUMN WIDTHS (auto-balanced)
//      ============================================================ */
//   const colWidths = [40, 120, 100, 100, 80, 80, 80, 60, 60, 80];
//   let startY = 140;
//   const startX = 40;

//   doc.setFontSize(9);

//   /* ============================================================
//      DRAW HEADER
//      ============================================================ */
//   function drawHeader(y) {
//     const totalWidth = colWidths.reduce((a, b) => a + b, 0);

//     doc.setFillColor(220, 220, 220);
//     doc.rect(startX, y - 12, totalWidth, 18, "F");

//     doc.setFont(undefined, "bold");
//     headerCells.forEach((text, i) => {
//       const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
//       doc.text(text, cellX + 4, y);
//     });

//     doc.setDrawColor(0);
//     doc.line(startX, y + 4, startX + totalWidth, y + 4);

//     doc.setFont(undefined, "normal");
//   }

//   drawHeader(startY);
//   startY += 15;

//   /* ============================================================
//      DRAW ROWS
//      ============================================================ */
//   bodyData.forEach((row, rowIndex) => {
//     const rowY = startY;

//     const wrappedRow = row.map((cell, i) =>
//       doc.splitTextToSize(String(cell), colWidths[i] - 8)
//     );

//     let maxLines = Math.max(...wrappedRow.map((w) => w.length));
//     const rowHeight = 15 * maxLines;

//     if (rowIndex % 2 !== 0) {
//       doc.setFillColor(240, 240, 240);
//       doc.rect(
//         startX,
//         rowY - 10,
//         colWidths.reduce((a, b) => a + b, 0),
//         rowHeight,
//         "F"
//       );
//     }

//     row.forEach((cell, i) => {
//       const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
//       doc.text(wrappedRow[i], cellX + 4, rowY);
//     });

//     startY += rowHeight;

//     if (startY > 550) {
//       doc.addPage();
//       startY = 50;
//       drawHeader(startY);
//       startY += 15;
//     }
//   });

//   /* ============================================================
//      PAGE NUMBERS
//      ============================================================ */
//   const pageCount = doc.internal.getNumberOfPages();
//   for (let i = 1; i <= pageCount; i++) {
//     doc.setPage(i);
//     doc.setFontSize(9);
//     doc.text(
//       `Page ${i} of ${pageCount}`,
//       doc.internal.pageSize.getWidth() - 80,
//       doc.internal.pageSize.getHeight() - 20
//     );
//   }

//   /* ============================================================
//      SAVE PDF
//      ============================================================ */
//   doc.save("inventory-report.pdf");
// }

/* ============================================================
   EXPORT INVENTORY TO PDF (A4 LANDSCAPE, ALL FILTERED ROWS)
   ============================================================ */
async function exportInventoryToPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("jsPDF failed to load.");
    return;
  }

  // ✅ Ensure we have the full filtered dataset
  if (!inventoryFilteredData || inventoryFilteredData.length === 0) {
    alert("No inventory data to export.");
    return;
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  /* ============================================================
     HEADER: LOGO + APP NAME
     ============================================================ */
  const logoPath = "Resources/Dims 400 x 400.png";
  doc.addImage(logoPath, "PNG", 40, 20, 40, 40);

  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Cathy-D", 84, 47);
  doc.setTextColor(0, 128, 0);
  doc.text("i", 153, 47);
  doc.setTextColor(0, 0, 0);
  doc.text("MS", 158, 47);

  // ✅ Get facility + prepared by
  const { facilityName, preparedBy } = await getReportInfo();
  console.log("Report Info for PDF:", facilityName, preparedBy);

  /* ============================================================
     TITLE + DATE/TIME
     ============================================================ */
  doc.setFontSize(16);
  doc.setFont(undefined, "normal");
  doc.text("Inventory Report", 40, 80);

  const now = new Date();
  const datePrepared = `${String(now.getDate()).padStart(2, "0")}/${String(
    now.getMonth() + 1
  ).padStart(2, "0")}/${now.getFullYear()}`;
  const timePrepared = now.toLocaleTimeString();

  doc.setFontSize(11);
  doc.text(`Date Prepared: ${datePrepared}`, 40, 100);
  doc.text(`Time: ${timePrepared}`, 400, 100);

  // ✅ Facility + Prepared by on same row, aligned under Time
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");

  const facilityText = doc.splitTextToSize(
    `Facility Name: ${facilityName || "—"}`,
    300
  );
  doc.text(facilityText, 40, 115);

  const preparedText = doc.splitTextToSize(
    `Prepared by: ${preparedBy || "—"}`,
    200
  );
  doc.text(preparedText, 400, 115);

  /* ============================================================
     TABLE HEADERS (skip Action column)
     ============================================================ */
  const headerCells = [
    "S/N",
    "Name",
    "Classification",
    "Subclass",
    "Expiry",
    "Pack Size",
    "Unit",
    "Qty",
    "Critical",
    "Status",
  ];

  /* ============================================================
     BUILD BODY DATA FROM inventoryFilteredData
     ============================================================ */
  const bodyData = inventoryFilteredData.map((drug, index) => {
    let statusText = "Ok";
    if (drug.quantity === 0) statusText = "OS";
    else if (drug.quantity <= (drug.criticalLevel || 0)) statusText = "Critical";

    return [
      String(index + 1),
      drug.name || "-",
      drug.classification || "-",
      drug.subClass || "-",
      drug.expiry || "-",
      drug.packSize || "-",
      drug.unit || "-",
      String(drug.quantity),
      String(drug.criticalLevel || 0),
      statusText,
    ];
  });

  /* ============================================================
     COLUMN WIDTHS (auto-balanced)
     ============================================================ */
  const colWidths = [40, 145, 100, 100, 80, 60, 60, 50, 50, 60];
  let startY = 145;
  const startX = 40;

  doc.setFontSize(10);

  /* ============================================================
     DRAW HEADER
     ============================================================ */
  function drawHeader(y) {
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    doc.setFillColor(220, 220, 220);
    doc.rect(startX, y - 12, totalWidth, 20, "F"); // Adjust header height separately: change 20

    doc.setFont(undefined, "bold"); // Sets bold font.
    headerCells.forEach((text, i) => {
      const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(text, cellX + 4, y); // To move text up: use y - offset.
    });

    doc.setDrawColor(0);
    doc.line(startX, y + 6, startX + totalWidth, y + 6); // Move line up/down: adjust y + 6. Smaller = closer to text

    doc.setFont(undefined, "normal"); // Resets font to normal weight for body rows.
  }

  drawHeader(startY); // Calls drawHeader at current Y position.
  startY += 18; // Adjust 18 to control spacing between header and first row.

  /* ============================================================
     DRAW ROWS
     ============================================================ */
  bodyData.forEach((row, rowIndex) => {
    const rowY = startY;

    const wrappedRow = row.map((cell, i) => // Wraps text inside each cell to fit column width.
      doc.splitTextToSize(String(cell), colWidths[i] - 8) // colWidths[i] - 8 gives margin inside cell
    );

    let maxLines = Math.max(...wrappedRow.map((w) => w.length));
    const rowHeight = 16 * maxLines; // Adjust body row height: change 16 to another value.

    if (rowIndex % 2 !== 0) {
      doc.setFillColor(240, 240, 240);
      doc.rect(
        startX,
        rowY - 10, // Adjust rowY - 10 to move shading up/down.
        colWidths.reduce((a, b) => a + b, 0),
        rowHeight, // Adjust rowHeight multiplier to change row height.
        "F"
      );
    }

    row.forEach((cell, i) => {
      const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(wrappedRow[i], cellX + 4, rowY + 1); // Vertical alignment of row text:
    });

    startY += rowHeight;

    if (startY > 550) { 
      doc.addPage(); // If page overflow, adds new page.
      startY = 50; // Resets startY to 50.
      drawHeader(startY); // Draws header again.
      startY += 15; // Moves down 15 for first row.
    }
  });

  /* ============================================================
     PAGE NUMBERS
     ============================================================ */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 80,
      doc.internal.pageSize.getHeight() - 20
    );
  }

  /* ============================================================
     SAVE PDF
     ============================================================ */
  doc.save("inventory-report.pdf");
}


// ++++++++++++++ Inventory Logic Ends +++++++++++++++++++

/* ============================================================
   DISPENSE LOGIC
   ============================================================ */

  /* =================
   DISPENSE PAGINATION (GLOBAL STATE)
   ================= */
  let dispenseCurrentPage = 1;        // current page index (1-based)
  let dispensePageSize = 10;          // rows per page (default)
  let dispenseTotalPages = 1;         // total pages after filtering
  let dispenseFilteredData = [];      // holds filtered + sorted dispense records
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  /* ============================================================
   DISPENSE PAGINATION HELPERS (SMART PAGINATION)
   ============================================================ */

/**
 * Builds the smart pagination page number buttons:
 * Example:
 *   1 … 43 44 [45] 46 47 … 90
 */
function buildDispensePageNumbers() {
  const container = document.getElementById("dispense-page-numbers");
  container.innerHTML = "";

  const total = dispenseTotalPages;
  const current = dispenseCurrentPage;

  // If only 1 page, no need to render anything
  if (total <= 1) return;

  // Helper to create a page button
  const createBtn = (page, isActive = false) => {
    const btn = document.createElement("button");
    btn.textContent = page;
    btn.className =
      "px-2 py-1 border rounded text-sm " +
      (isActive
        ? "bg-blue-600 text-white font-semibold"
        : "dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600");

    btn.addEventListener("click", () => {
      dispenseCurrentPage = page;
      refreshDispenseTable();
    });

    return btn;
  };

  // Helper to create ellipsis
  const createEllipsis = () => {
    const span = document.createElement("span");
    span.textContent = "…";
    span.className = "px-2 text-gray-500";
    return span;
  };

  /* ============================================================
     ALWAYS SHOW FIRST PAGE
     ============================================================ */
  container.appendChild(createBtn(1, current === 1));

  /* ============================================================
     LEFT ELLIPSIS (if needed)
     ============================================================ */
  if (current > 2) {
    container.appendChild(createEllipsis());
  }

  /* ============================================================
     PAGES AROUND CURRENT PAGE
     ============================================================ */
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  for (let p = start; p <= end; p++) {
    container.appendChild(createBtn(p, p === current));
  }

  /* ============================================================
     RIGHT ELLIPSIS (if needed)
     ============================================================ */
  if (current < total - 1) {
    container.appendChild(createEllipsis());
  }

  /* ============================================================
     ALWAYS SHOW LAST PAGE
     ============================================================ */
  if (total > 1) {
    container.appendChild(createBtn(total, current === total));
  }
}

/**
 * Enables/disables Prev/Next buttons based on current page.
 */
function updateDispensePaginationUI() {
  const prevBtn = document.getElementById("dispense-prev-page");
  const nextBtn = document.getElementById("dispense-next-page");

  // Disable Prev on first page
  prevBtn.disabled = dispenseCurrentPage <= 1;

  // Disable Next on last page
  nextBtn.disabled = dispenseCurrentPage >= dispenseTotalPages;

  // Rebuild page numbers
  buildDispensePageNumbers();
}
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  /* ============================================================
    DISPENSE LOGIC (WITH PAGINATION LISTENERS)
   ============================================================ */
async function initDispense() {
  const form = document.getElementById("dispense-form");
  const deptSelect = document.getElementById("dispense-department-select");
  const deptText = document.getElementById("dispense-department-text");

  const authSelect = document.getElementById("authorized-by-select");
  const authText = document.getElementById("approved-by-text");

  // 🟢 Toggle manual input when "Other" is chosen for Department
  deptSelect.addEventListener("change", () => {
    if (deptSelect.value === "Other") {
      deptText.classList.remove("hidden");
    } else {
      deptText.classList.add("hidden");
      deptText.value = "";
    }
  });

  // 🟢 Toggle manual input when "Other" is chosen for Authorized by
  authSelect.addEventListener("change", () => {
    if (authSelect.value === "Other") {
      authText.classList.remove("hidden");
    } else {
      authText.classList.add("hidden");
      authText.value = "";
    }
  });

  // Load dropdown + table
  await refreshDispenseDrugOptions();
  await refreshDispenseTable();

  // 🟢 Initialize delete modal
  initDispenseDeleteModal();

  // 🟢 Initialize success modal OK handler
  initSuccessDeleteModal();

  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    /* ============================================================
    ✅ PAGINATION EVENT LISTENERS
     ============================================================ */

  // Rows per page selector
  document.getElementById("dispense-page-size").addEventListener("change", (e) => {
    dispensePageSize = Number(e.target.value);
    dispenseCurrentPage = 1; // reset to first page
    refreshDispenseTable();
  });

  // Prev page
  document.getElementById("dispense-prev-page").addEventListener("click", () => {
    if (dispenseCurrentPage > 1) {
      dispenseCurrentPage--;
      refreshDispenseTable();
    }
  });

  // Next page
  document.getElementById("dispense-next-page").addEventListener("click", () => {
    if (dispenseCurrentPage < dispenseTotalPages) {
      dispenseCurrentPage++;
      refreshDispenseTable();
    }
  });
  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

  /* ============================================================
    ✅ FORM SUBMISSION LOGIC
     ============================================================ */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const drugId = Number(document.getElementById("dispense-drug").value);
    const deptVal =
      deptSelect.value === "Other"
        ? deptText.value.trim()
        : deptSelect.value;
    const qty = Number(document.getElementById("dispense-quantity").value);

    const approveVal =
      authSelect.value === "Other" ? authText.value.trim() : authSelect.value;

    if (!drugId || !deptVal || qty <= 0 || !approveVal) {
      alert("Please select a drug, department, valid quantity, and authorization.");
      return;
    }

    const drugs = await getAllDrugs();
    const drug = drugs.find((d) => d.id === drugId);
    if (!drug) {
      alert("Drug not found.");
      return;
    }

    if (drug.quantity < qty) {
      alert("Not enough stock available.");
      return;
    }

    // Deduct stock
    drug.quantity -= qty;
    await saveDrug(drug);

    // Save dispense record
    const record = {
      drugId,
      drugName: drug.name || "—",
      classification: drug.classification || "—",
      subClass: drug.subClass || "—",   // include if you want to show it later
      expiry: drug.expiry || "—",
      drugUnit: drug.unit || "—",
      department: deptVal || "—",
      quantityDispensed: qty,
      dateDispensed: new Date().toISOString(),
      approvedBy: approveVal || "—",
    };

    await saveDispense(record);

    // Reset form
    form.reset();
    deptText.classList.add("hidden");
    authText.classList.add("hidden");

    // Refresh UI
    await refreshInventoryTable();
    await refreshDispenseTable();
    await refreshDispenseDrugOptions();
  });
}


async function refreshDispenseDrugOptions() {
  const select = document.getElementById("dispense-drug");
  if (!select) return;

  let drugs = await getAllDrugs();

  // Alphabetical ordering
  drugs.sort((a, b) => a.name.localeCompare(b.name));

  select.innerHTML = '<option value="">Select drug</option>';

  drugs.forEach((drug) => {
    const opt = document.createElement("option");
    opt.value = drug.id;
    opt.textContent = `${drug.name} (Qty: ${drug.quantity})`;
    select.appendChild(opt);
  });
}

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
/* ============================================================
   REFRESH DISPENSE TABLE (WITH SMART PAGINATION + NO RESULTS)
   ============================================================ */
async function refreshDispenseTable() {
  const tbody = document.getElementById("dispense-table-body");
  tbody.innerHTML = "";

  // Fetch last 100 dispense records
  let records = await getRecentDispenses(100);

  // Alphabetical by drug name
  records.sort((a, b) => a.drugName.localeCompare(b.drugName));

  /* ============================================================
     ✅ STORE FILTERED RESULTS FOR PAGINATION
     ============================================================ */
  dispenseFilteredData = records;

  /* ============================================================
     ✅ NO RESULTS HANDLING
     ============================================================ */
  if (dispenseFilteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-4 text-gray-500">
          No matching records found.
        </td>
      </tr>
    `;
    dispenseTotalPages = 1;
    dispenseCurrentPage = 1;
    updateDispensePaginationUI();
    return;
  }

  /* ============================================================
     ✅ PAGINATION CALCULATIONS
     ============================================================ */
  dispenseTotalPages = Math.max(
    1,
    Math.ceil(dispenseFilteredData.length / dispensePageSize)
  );

  // Ensure current page is valid
  if (dispenseCurrentPage > dispenseTotalPages) {
    dispenseCurrentPage = dispenseTotalPages;
  }

  const startIndex = (dispenseCurrentPage - 1) * dispensePageSize;
  const endIndex = startIndex + dispensePageSize;
  const pageData = dispenseFilteredData.slice(startIndex, endIndex);

  /* ============================================================
     ✅ TABLE RENDERING (USING pageData)
     ============================================================ */

  let sn = startIndex + 1;

  pageData.forEach((r) => {
    const tr = document.createElement("tr");
    const dateStr = r.dateDispensed
      ? new Date(r.dateDispensed).toLocaleString()
      : "—";

    // Expiry color coding
    let expiryClass = "";
    if (r.expiry && r.expiry.includes("/")) {
      const [day, month, year] = r.expiry.split("/");
      const dateObj = new Date(year, month - 1, day);
      const today = new Date();
      const diffMs = dateObj - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        expiryClass = "text-red-600 font-semibold";     // expired
      } else if (diffDays <= 5) {
        expiryClass = "text-orange-500 font-semibold";  // near expiry
      } else {
        expiryClass = "text-green-600 font-semibold";   // safe
      }
    }

    tr.innerHTML = `
      <td class="px-2 py-1">${sn++}</td>
      <td class="px-2 py-1">${dateStr}</td>
      <td class="px-2 py-1">${r.drugName || "—"}</td>
      <td class="px-2 py-1">${r.classification || "—"}</td>
      <td class="px-2 py-1">${r.subClass || "—"}</td>
      <td class="px-2 py-1 ${expiryClass}">${r.expiry || "—"}</td>
      <td class="px-2 py-1">${r.drugUnit || "—"}</td>
      <td class="px-2 py-1">${r.quantityDispensed || "—"}</td>
      <td class="px-2 py-1">${r.department || "—"}</td>
      <td class="px-2 py-1">${r.approvedBy || "—"}</td>
      <!-- 🟢 New Delete button -->
      <td class="px-2 py-1">
        <button class="delete-dispense-btn px-2 py-1 bg-red-600 text-white rounded text-xs"
                data-id="${r.id}"
                data-name="${r.drugName || ''}">
          Delete
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  /* ============================================================
     ✅ UPDATE PAGINATION UI
     ============================================================ */
  updateDispensePaginationUI();

  /* ============================================================
     ✅ SMOOTH SCROLL TO DISPENSE SECTION
     ============================================================ */
  const section = document.getElementById("dispense-section");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}

/* ============================================================
   DISPENSE DELETE LOGIC
   ============================================================ */
// function initDispenseDeleteModal() {
//   const modal = document.getElementById("dispense-delete-modal");
//   const cancelBtn = document.getElementById("dispense-delete-cancel");
//   const confirmBtn = document.getElementById("dispense-delete-confirm");

//   let targetId = null;

//   // 🟢 Listen for delete button clicks
//   document.addEventListener("click", (e) => {
//     if (e.target.classList.contains("delete-dispense-btn")) {
//       targetId = Number(e.target.dataset.id);
//       modal.classList.remove("hidden");
//     }
//   });

//   // 🟢 Cancel button
//   cancelBtn.addEventListener("click", () => {
//     modal.classList.add("hidden");
//     targetId = null;
//   });

//   // 🟢 Confirm delete
//   confirmBtn.addEventListener("click", async () => {
//     if (targetId) {
//       await deleteDispense(targetId); // you’ll need to implement deleteDispense in IndexedDB
//       await refreshDispenseTable();
//       modal.classList.add("hidden");

//       // Show success modal (reuse inventory’s success modal)
//       document.getElementById("success-delete-modal").classList.remove("hidden");
//     }
//   });
// }

  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


  // ++++++++++++++++ REPORTS SECTION LOGIC STARTS HERE ++++++++++++
  /* ============================================================
    REPORTS PAGINATION (GLOBAL STATE)
   ============================================================ */
  let reportsCurrentPage = 1;
  let reportsPageSize = 25;
  let reportsTotalPages = 1;
  let reportsFilteredData = []; // full filtered dataset (used for table + PDF)

  /* ============================================================
   REPORTS PAGINATION HELPERS (SMART PAGINATION)
   ============================================================ */
// function buildReportsPageNumbers() {
//   const container = document.getElementById("reports-page-numbers");
//   if (!container) return;
//   container.innerHTML = "";

//   const total = reportsTotalPages;
//   const current = reportsCurrentPage;

//   if (total <= 1) return;

//   const createBtn = (page, isActive = false) => {
//     const btn = document.createElement("button");
//     btn.textContent = page;
//     btn.className =
//       "px-2 py-1 border rounded text-sm " +
//       (isActive
//         ? "bg-blue-600 text-white font-semibold"
//         : "dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600");
//     btn.addEventListener("click", () => {
//       reportsCurrentPage = page;
//       renderReportsTable(); // only re-render table slice
//     });
//     return btn;
//   };

//   const createEllipsis = () => {
//     const span = document.createElement("span");
//     span.textContent = "…";
//     span.className = "px-2 text-gray-500";
//     return span;
//   };

//   // First page
//   container.appendChild(createBtn(1, current === 1));

//   // Left ellipsis
//   if (current > 2) container.appendChild(createEllipsis());

//   // Middle pages
//   const start = Math.max(2, current - 2);
//   const end = Math.min(total - 1, current + 2);
//   for (let p = start; p <= end; p++) {
//     container.appendChild(createBtn(p, p === current));
//   }

//   // Right ellipsis
//   if (current < total - 1) container.appendChild(createEllipsis());

//   // Last page
//   if (total > 1) container.appendChild(createBtn(total, current === total));
// }

/* ============================================================
   REPORTS SMART PAGINATION BUILDER (compact style)
   ============================================================ */
function buildReportsPageNumbers() {
  const container = document.getElementById("reports-page-numbers");
  if (!container) return;
  container.innerHTML = "";

  const total = reportsTotalPages;
  const current = reportsCurrentPage;

  if (total <= 1) return;

  // Helper: create page button
  const createBtn = (page, isActive = false) => {
    const btn = document.createElement("button");
    btn.textContent = page;
    btn.className =
      "px-2 py-1 border rounded text-sm " +
      (isActive
        ? "bg-blue-600 text-white font-semibold"
        : "bg-gray-100 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600");
    btn.addEventListener("click", () => {
      reportsCurrentPage = page;
      renderReportsTable(); // re-render table slice
      updateReportsPaginationUI(); // ✅ ensure pagination updates too
    });
    return btn;
  };

  // Helper: ellipsis
  const createEllipsis = () => {
    const span = document.createElement("span");
    span.textContent = "…";
    span.className = "px-2 text-gray-500";
    return span;
  };

  // Always show first page
  container.appendChild(createBtn(1, current === 1));

  // Left ellipsis if needed
  if (current > 3) {
    container.appendChild(createEllipsis());
  }

  // Current page ±1
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) {
    container.appendChild(createBtn(p, p === current));
  }

  // Right ellipsis if needed
  if (current < total - 2) {
    container.appendChild(createEllipsis());
  }

  // Always show last page
  if (total > 1) {
    container.appendChild(createBtn(total, current === total));
  }
}


          // ++++++++++++++++++ 29 Dec 2025 ++++++++++++++++

function updateReportsPaginationUI() {
  const prevBtn = document.getElementById("reports-prev-page");
  const nextBtn = document.getElementById("reports-next-page");

  if (prevBtn) prevBtn.disabled = reportsCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = reportsCurrentPage >= reportsTotalPages;

  buildReportsPageNumbers();
}

  // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

/* ============================================================
   REPORTS (FILTERING, SUMMARY, SERIAL NUMBERING)
   ============================================================ */

function getDateRangeForPeriod(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(now.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

async function initReports() {
  const periodSelect = document.getElementById("report-period");
  const fromInput = document.getElementById("report-from");
  const toInput = document.getElementById("report-to");
  const deptInput = document.getElementById("report-department");

  // Filters update reports
  periodSelect.addEventListener("change", () => {
    reportsCurrentPage = 1;
    updateReports();
  });
  fromInput.addEventListener("change", () => {
    reportsCurrentPage = 1;
    updateReports();
  });
  toInput.addEventListener("change", () => {
    reportsCurrentPage = 1;
    updateReports();
  });
  deptInput.addEventListener("input", () => {
    reportsCurrentPage = 1;
    updateReports();
  });

  // Sorting
  document.getElementById("report-sort").addEventListener("change", (e) => {
    reportCurrentSort = e.target.value;
    reportsCurrentPage = 1;
    updateReports();
  });

  // Pagination controls
  const pageSizeSelect = document.getElementById("reports-page-size");
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", (e) => {
      reportsPageSize = Number(e.target.value) || 25;
      reportsCurrentPage = 1;
      renderReportsTable();
    });
  }

  const prevBtn = document.getElementById("reports-prev-page");
  const nextBtn = document.getElementById("reports-next-page");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (reportsCurrentPage > 1) {
        reportsCurrentPage--;
        renderReportsTable();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (reportsCurrentPage < reportsTotalPages) {
        reportsCurrentPage++;
        renderReportsTable();
      }
    });
  }

  // Export buttons
  // document
  //   .getElementById("btn-export-pdf")
  //   .addEventListener("click", exportReportToPDF);
  // document
  //   .getElementById("btn-export-excel")
  //   .addEventListener("click", exportReportToExcel);

    // ====== 12 Dec code start ========

    // PDF buttons
  const exportPDFBtn = document.getElementById("btn-export-pdf");
  if (exportPDFBtn) {
    exportPDFBtn.addEventListener("click", exportReportToPDF);
  }

  const dashBtn = document.getElementById("btn-dashboard-summary-pdf");
  if (dashBtn) {
    dashBtn.addEventListener("click", exportDashboardSummaryPDF);
  }

  const customRangeBtn = document.getElementById("btn-custom-range-pdf");
  if (customRangeBtn) {
    customRangeBtn.addEventListener("click", exportCustomRangeReportPDF);
  }

    // ====== 12 Dec code start ========
  // Initial load
  updateReports();
}


/* ============================================================
   REPORTS (FILTERING, SUMMARY, PAGINATION)
   ============================================================ */
async function updateReports() {
  const period = document.getElementById("report-period").value;
  const fromVal = document.getElementById("report-from").value;
  const toVal = document.getElementById("report-to").value;
  const departmentFilter = document
    .getElementById("report-department")
    .value.toLowerCase();

  let start, end;

  if (period === "custom" && fromVal && toVal) {
    start = new Date(fromVal);
    start.setHours(0, 0, 0, 0);
    end = new Date(toVal);
    end.setHours(23, 59, 59, 999);
  } else if (period !== "custom") {
    ({ start, end } = getDateRangeForPeriod(period));
    document.getElementById("report-from").value =
      start.toISOString().slice(0, 10);
    document.getElementById("report-to").value =
      end.toISOString().slice(0, 10);
  } else {
    // custom period but missing dates
    return;
  }

  const records = await getAllDispenses();

  // 🟢 Debug log: see what we got from IndexedDB
  console.log("updateReports → raw dispenses from DB:", records.length, records);

  let filtered = records.filter((r) => {
    const d = new Date(r.dateDispensed);
    const inRange = d >= start && d <= end;
    const deptMatch = (r.department || "")
      .toLowerCase()
      .includes(departmentFilter);
    return inRange && deptMatch;
  });

   // 🟢 Debug log: after filtering
  console.log("updateReports → after filters:", filtered.length, filtered);

  // SORTING
  if (reportCurrentSort === "date-desc") {
    filtered.sort((a, b) => new Date(b.dateDispensed) - new Date(a.dateDispensed));
  } else if (reportCurrentSort === "date-asc") {
    filtered.sort((a, b) => new Date(a.dateDispensed) - new Date(b.dateDispensed));
  } else if (reportCurrentSort === "drug-asc") {
    filtered.sort((a, b) => a.drugName.localeCompare(b.drugName));
  } else if (reportCurrentSort === "drug-desc") {
    filtered.sort((a, b) => b.drugName.localeCompare(a.drugName));
  } else if (reportCurrentSort === "qty-asc") {
    filtered.sort((a, b) => (a.quantityDispensed || 0) - (b.quantityDispensed || 0));
  } else if (reportCurrentSort === "qty-desc") {
    filtered.sort((a, b) => (b.quantityDispensed || 0) - (a.quantityDispensed || 0));
  } else if (reportCurrentSort === "dept-asc") {
    filtered.sort((a, b) => (a.department || "").localeCompare(b.department || ""));
  }

  // Store full filtered dataset for table, summary, and PDF
  reportsFilteredData = filtered;

   // 🟢 Debug log: final dataset stored
  console.log("updateReports → reportsFilteredData:", reportsFilteredData.length, reportsFilteredData);

  // Summary
  const totalQty = reportsFilteredData.reduce(
    (sum, r) => sum + (r.quantityDispensed || 0),
    0
  );
  document.getElementById("report-total-qty").textContent = totalQty;
  document.getElementById("report-total-count").textContent =
    reportsFilteredData.length;

  // Per-department summary
  const deptSummaryDiv = document.getElementById("report-dept-summary");
  deptSummaryDiv.innerHTML = "";
  const byDept = {};

  reportsFilteredData.forEach((r) => {
    const dept = r.department || "Unknown";
    if (!byDept[dept]) {
      byDept[dept] = { totalQty: 0, count: 0 };
    }
    byDept[dept].totalQty += r.quantityDispensed || 0;
    byDept[dept].count += 1;
  });

  const deptEntries = Object.entries(byDept);

  if (deptEntries.length === 0) {
    deptSummaryDiv.textContent = "No data for this period.";
  } else {
    deptEntries.forEach(([dept, stats]) => {
      const p = document.createElement("p");
      p.textContent = `${dept}: ${stats.totalQty} units in ${stats.count} dispenses`;
      deptSummaryDiv.appendChild(p);
    });
  }

  // Pagination calculation
  reportsTotalPages = Math.max(
    1,
    Math.ceil(reportsFilteredData.length / reportsPageSize)
  );
  if (reportsCurrentPage > reportsTotalPages) {
    reportsCurrentPage = reportsTotalPages;
  }
  if (reportsFilteredData.length === 0) {
    reportsCurrentPage = 1;
  }

  // ✅ Ensure pagination UI updates immediately
  updateReportsPaginationUI();

  // Render table slice
  renderReportsTable();

  // Smooth scroll to reports section
  const section = document.getElementById("section-reports");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}

/* ============================================================
   RENDER REPORTS TABLE (USES PAGINATION SLICE)
   ============================================================ */
function renderReportsTable() {
  const tbody = document.getElementById("reports-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!reportsFilteredData || reportsFilteredData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-gray-500">
          No matching records found.
        </td>
      </tr>
    `;
    reportsTotalPages = 1;
    reportsCurrentPage = 1;
    updateReportsPaginationUI();
    return;
  }

  const startIndex = (reportsCurrentPage - 1) * reportsPageSize;
  const endIndex = startIndex + reportsPageSize;
  const pageData = reportsFilteredData.slice(startIndex, endIndex);

  let sn = startIndex + 1;

  pageData.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-2 py-1">${sn++}</td>
      <td class="px-2 py-1">${new Date(r.dateDispensed).toLocaleString()}</td>
      <td class="px-2 py-1">${r.drugName}</td>
      <td class="px-2 py-1">${r.department}</td>
      <td class="px-2 py-1">${r.quantityDispensed}</td>
      <td class="px-2 py-1">${r.classification || "-"}</td>
    `;
    tbody.appendChild(tr);
  });

  updateReportsPaginationUI();
}


// /* ============================================================
//    EXPORT REPORT TO PDF (A4 LANDSCAPE, WITH SERIAL NUMBERS)
//    ============================================================ */

// function exportReportToPDF() {
//   const { jsPDF } = window.jspdf || {};
//   if (!jsPDF) {
//     alert("jsPDF failed to load.");
//     return;
//   }

//   // ============================================================
//   // INITIALIZE DOCUMENT
//   // ============================================================
//   const doc = new jsPDF({
//     orientation: "landscape",
//     unit: "pt",
//     format: "a4",
//   });

//   // ============================================================
//   // LOGO + APP NAME (TOP OF FIRST PAGE)
//   // ============================================================
//   const logoPath = "Resources/Dims 400 x 400.png"; 
//   doc.addImage(logoPath, "PNG", 40, 20, 40, 40); 
//   doc.setFontSize(18);
//   doc.setFont(undefined, "bold");
//   doc.setTextColor(0, 0, 0);
//   doc.text("Cathy-D", 84, 47);
//   doc.setTextColor(0, 128, 0);
//   doc.text("i", 153, 47);
//   doc.setTextColor(0, 0, 0);
//   doc.text("MS", 158, 47);

//   // ============================================================
//   // REPORT TITLE
//   // ============================================================
//   doc.setFontSize(16);
//   doc.setFont(undefined, "normal");
//   doc.text("Dispense Report", 40, 80);

//   // ============================================================
//   // DATE + TIME + PERIOD + DEPARTMENT FILTER
//   // ============================================================
//   const now = new Date();
//   const datePrepared = `${String(now.getDate()).padStart(2, "0")}/${String(
//     now.getMonth() + 1
//   ).padStart(2, "0")}/${now.getFullYear()}`;
//   const timePrepared = now.toLocaleTimeString();

//   const from = document.getElementById("report-from").value;
//   const to = document.getElementById("report-to").value;
//   const period = document.getElementById("report-period").value;
//   const dept = document.getElementById("report-department").value;

//   const fromDate = new Date(from);
//   const toDate = new Date(to);
//   const formatDate = (d) =>
//     `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
//       2,
//       "0"
//     )}/${d.getFullYear()}`;

//   const periodText = `${period.toUpperCase()} (${formatDate(fromDate)} to ${formatDate(
//     toDate
//   )})`;

//   doc.setFontSize(10);
//   doc.setTextColor(0, 0, 0);
//   doc.text(`Period: ${periodText}`, 40, 100);
//   doc.text(`Date Prepared: ${datePrepared}`, 400, 100); 
//   doc.text(`Department filter: ${dept || "All"}`, 40, 115);
//   doc.text(`Time: ${timePrepared}`, 400, 115); 

//   // ============================================================
//   // TABLE SETUP
//   // ============================================================
//   const table = document.getElementById("reports-table");
//   const rows = Array.from(table.querySelectorAll("tbody tr"));
//   const headerCells = Array.from(table.querySelectorAll("thead th")).map((th) =>
//     th.textContent.trim()
//   );

//   const bodyData = rows.map((tr) =>
//     Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim())
//   );

//   // Column widths (reduce S/N and Qty)
//   const colWidths = [40, 100, 100, 100, 50, 100, 100]; 
//   let startY = 140;
//   let startX = 40;

//   doc.setFontSize(9);

//   // ============================================================
//   // DRAW TABLE HEADER (BOLD + SHADED + SEPARATOR LINE)
//   // ============================================================
//   function drawHeader(y) {
//     const totalWidth = colWidths.reduce((a, b) => a + b, 0);
//     doc.setFillColor(220, 220, 220); 
//     doc.rect(startX, y - 12, totalWidth, 18, "F");

//     doc.setFont(undefined, "bold");
//     headerCells.forEach((text, i) => {
//       const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
//       if (i === 0 || i === 4) {
//         doc.text(text, cellX + colWidths[i] / 2, y, { align: "center" });
//       } else {
//         doc.text(text, cellX + 4, y, { align: "left" }); // slight padding
//       }
//     });

//     doc.setDrawColor(0);
//     doc.setLineWidth(0.5);
//     doc.line(startX, y + 4, startX + totalWidth, y + 4);

//     doc.setFont(undefined, "normal");
//   }

//   drawHeader(startY);
//   startY += 15;

//   // ============================================================
//   // DRAW TABLE ROWS (ALTERNATING SHADING + WRAPPING + ALIGNMENT)
//   // ============================================================
//   bodyData.forEach((row, rowIndex) => {
//     const rowY = startY;

//     // First pass: wrap text for each cell
//     const wrappedRow = row.map((cell, i) =>
//       doc.splitTextToSize(String(cell), colWidths[i] - 8) // padding
//     );

//     // Find tallest cell (max lines)
//     let maxLineCount = 1;
//     wrappedRow.forEach((wrappedText) => {
//       if (wrappedText.length > maxLineCount) {
//         maxLineCount = wrappedText.length;
//       }
//     });

//     const rowHeight = 15 * maxLineCount;

//     // Alternating row shading (dynamic height)
//     if (rowIndex % 2 !== 0) {
//       doc.setFillColor(240, 240, 240);
//       doc.rect(startX, rowY - 10, colWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
//     }

//     // Draw text in each cell
//     row.forEach((cell, i) => {
//       const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
//       const wrappedText = wrappedRow[i];

//       if (i === 0 || i === 4) {
//         // Center numeric columns
//         doc.text(wrappedText, cellX + colWidths[i] / 2, rowY, { align: "center" });
//       } else {
//         // Left align text columns with padding
//         doc.text(wrappedText, cellX + 4, rowY, { align: "left" });
//       }
//     });

//     // Move Y down by dynamic row height
//     startY += rowHeight;

//     // Handle page overflow
//     if (startY > 550) {
//       doc.addPage();
//       startY = 50;
//       drawHeader(startY);
//       startY += 15;
//     }
//   });

//   // ============================================================
//   // PAGINATION (BOTTOM RIGHT)
//   // ============================================================
//   const pageCount = doc.internal.getNumberOfPages();
//   for (let i = 1; i <= pageCount; i++) {
//     doc.setPage(i);
//     doc.setFontSize(9);
//     doc.text(
//       `Page ${i} of ${pageCount}`,
//       doc.internal.pageSize.getWidth() - 80,
//       doc.internal.pageSize.getHeight() - 20
//     );
//   }

//   // ============================================================
//   // SAVE PDF
//   // ============================================================
//   doc.save("dispense-report.pdf");
// }
  // ++++++++++++++ END OF EXPORT TO PDF ++++++++++++++++++++++++

/* ============================================================
   EXPORT REPORT TO PDF (A4 LANDSCAPE, ALL FILTERED ROWS)
   ============================================================ */
function exportReportToPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("jsPDF failed to load.");
    return;
  }

  // Ensure we have the latest filtered data
  if (!reportsFilteredData || reportsFilteredData.length === 0) {
    alert("No data to export for the current filters.");
    return;
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  // Logo + App name
  const logoPath = "Resources/Dims 400 x 400.png";
  doc.addImage(logoPath, "PNG", 40, 20, 40, 40);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Cathy-D", 84, 47);
  doc.setTextColor(0, 128, 0);
  doc.text("i", 153, 47);
  doc.setTextColor(0, 0, 0);
  doc.text("MS", 158, 47);

  // Title
  doc.setFontSize(16);
  doc.setFont(undefined, "normal");
  doc.text("Dispense Report", 40, 80);

  // Date + time + filters
  const now = new Date();
  const datePrepared = `${String(now.getDate()).padStart(2, "0")}/${String(
    now.getMonth() + 1
  ).padStart(2, "0")}/${now.getFullYear()}`;
  const timePrepared = now.toLocaleTimeString();

  const from = document.getElementById("report-from").value;
  const to = document.getElementById("report-to").value;
  const period = document.getElementById("report-period").value;
  const dept = document.getElementById("report-department").value;

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const formatDate = (d) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;

  const periodText = `${period.toUpperCase()} (${formatDate(
    fromDate
  )} to ${formatDate(toDate)})`;

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Period: ${periodText}`, 40, 100);
  doc.text(`Date Prepared: ${datePrepared}`, 400, 100);
  doc.text(`Department filter: ${dept || "All"}`, 40, 115);
  doc.text(`Time: ${timePrepared}`, 400, 115);

  // Table headers (same as HTML table)
  const headerCells = ["S/N", "Date", "Drug", "Department", "Qty", "Classification"];

  // Build bodyData from reportsFilteredData (ALL rows, not paginated slice)
  const bodyData = reportsFilteredData.map((r, index) => [
    String(index + 1),
    new Date(r.dateDispensed).toLocaleString(),
    r.drugName || "-",
    r.department || "-",
    String(r.quantityDispensed || 0),
    r.classification || "-",
  ]);

  // Column widths (tuned for A4 landscape)
  const colWidths = [40, 120, 120, 120, 50, 120];
  let startY = 140;
  const startX = 40;

  doc.setFontSize(9);

  function drawHeader(y) {
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    doc.setFillColor(220, 220, 220);
    doc.rect(startX, y - 12, totalWidth, 18, "F");

    doc.setFont(undefined, "bold");
    headerCells.forEach((text, i) => {
      const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      if (i === 0 || i === 4) {
        doc.text(text, cellX + colWidths[i] / 2, y, { align: "center" });
      } else {
        doc.text(text, cellX + 4, y, { align: "left" });
      }
    });

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(startX, y + 4, startX + totalWidth, y + 4);

    doc.setFont(undefined, "normal");
  }

  drawHeader(startY);
  startY += 15;

  bodyData.forEach((row, rowIndex) => {
    const rowY = startY;

    const wrappedRow = row.map((cell, i) =>
      doc.splitTextToSize(String(cell), colWidths[i] - 8)
    );

    let maxLineCount = 1;
    wrappedRow.forEach((wrappedText) => {
      if (wrappedText.length > maxLineCount) {
        maxLineCount = wrappedText.length;
      }
    });

    const rowHeight = 15 * maxLineCount;

    if (rowIndex % 2 !== 0) {
      doc.setFillColor(240, 240, 240);
      doc.rect(
        startX,
        rowY - 10,
        colWidths.reduce((a, b) => a + b, 0),
        rowHeight,
        "F"
      );
    }

    row.forEach((cell, i) => {
      const cellX = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      const wrappedText = wrappedRow[i];

      if (i === 0 || i === 4) {
        doc.text(wrappedText, cellX + colWidths[i] / 2, rowY, {
          align: "center",
        });
      } else {
        doc.text(wrappedText, cellX + 4, rowY, { align: "left" });
      }
    });

    startY += rowHeight;

    if (startY > 550) {
      doc.addPage();
      startY = 50;
      drawHeader(startY);
      startY += 15;
    }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 80,
      doc.internal.pageSize.getHeight() - 20
    );
  }

  doc.save("dispense-report.pdf");
}

 // ++++++++++++++ END OF EXPORT TO PDF Edited ++++++++++++++++++++++++

 /* ============================================================
   EXPORT REPORT (Dashboard Summary PDF) 12 Dec (A4 LANDSCAPE, No FILTERED ROWS)
   ============================================================ */
  async function exportDashboardSummaryPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("jsPDF failed to load.");
    return;
  }

  const drugs = await getAllDrugs();
  const dispenses = await getAllDispenses();

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  // Logo + App name
  const logoPath = "Resources/Dims 400 x 400.png";
  doc.addImage(logoPath, "PNG", 40, 20, 40, 40);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Cathy-D", 84, 47);
  doc.setTextColor(0, 128, 0);
  doc.text("i", 153, 47);
  doc.setTextColor(0, 0, 0);
  doc.text("MS", 158, 47);

  // Title
  doc.setFontSize(16);
  doc.setFont(undefined, "normal");
  doc.text("Dashboard Summary", 40, 80);

  const now = new Date();
  const datePrepared = formatDateDDMMYYYY(now);
  const timePrepared = now.toLocaleTimeString();

  doc.setFontSize(10);
  doc.text(`Date Prepared: ${datePrepared}`, 40, 100);
  doc.text(`Time: ${timePrepared}`, 400, 100);

  let y = 130;
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Inventory Summary", 40, y);
  doc.setFont(undefined, "normal");
  y += 15;

  // Inventory stats
  let inStock = 0;
  let outOfStock = 0;
  let critical = 0;
  let expired = 0;
  let expiringSoon = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  drugs.forEach((d) => {
    const qty = d.quantity || 0;
    const crit = d.criticalLevel || 0;

    if (qty === 0) outOfStock++;
    if (qty > 0) inStock++;
    if (qty > 0 && qty <= crit) critical++;

    if (d.expiry && d.expiry.includes("/")) {
      const [day, month, year] = d.expiry.split("/");
      const expDate = new Date(year, month - 1, day);
      expDate.setHours(0, 0, 0, 0);
      const diffMs = expDate - today;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) expired++;
      else if (diffDays <= 5) expiringSoon++;
    }
  });

  doc.setFontSize(10);
  doc.text(`Total drugs: ${drugs.length}`, 60, y); y += 14;
  doc.text(`In stock: ${inStock}`, 60, y); y += 14;
  doc.text(`Out of stock: ${outOfStock}`, 60, y); y += 14;
  doc.text(`Critical level: ${critical}`, 60, y); y += 14;
  doc.text(`Expired: ${expired}`, 60, y); y += 14;
  doc.text(`Expiring within 5 days: ${expiringSoon}`, 60, y); y += 20;

  // Dispense summary (today/week/month)
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Dispense Summary", 400, 130);
  doc.setFont(undefined, "normal");

  let y2 = 145;
  const startOfToday = new Date(today);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  function sumDispensesInRange(start, end) {
    return dispenses.reduce(
      (acc, r) => {
        const d = r.dateDispensed ? new Date(r.dateDispensed) : null;
        if (!d || isNaN(d)) return acc;
        if (d >= start && d <= end) {
          acc.count++;
          acc.totalQty += r.quantityDispensed || 0;
        }
        return acc;
      },
      { count: 0, totalQty: 0 }
    );
  }

  const todayStats = sumDispensesInRange(startOfToday, endOfToday);

  const startOfWeek = new Date(today);
  const dayOfWeek = startOfWeek.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const weekStats = sumDispensesInRange(startOfWeek, endOfWeek);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const monthStats = sumDispensesInRange(startOfMonth, endOfMonth);

  doc.setFontSize(10);
  doc.text(
    `Today: ${todayStats.count} dispenses, ${todayStats.totalQty} units`,
    400,
    y2
  ); y2 += 14;
  doc.text(
    `This week: ${weekStats.count} dispenses, ${weekStats.totalQty} units`,
    400,
    y2
  ); y2 += 14;
  doc.text(
    `This month: ${monthStats.count} dispenses, ${monthStats.totalQty} units`,
    400,
    y2
  ); y2 += 20;

  // Top 5 drugs
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Top 5 Drugs by Quantity Dispensed", 40, 260);
  doc.setFont(undefined, "normal");

  const qtyByDrug = {};
  dispenses.forEach((r) => {
    if (!r.drugName) return;
    qtyByDrug[r.drugName] =
      (qtyByDrug[r.drugName] || 0) + (r.quantityDispensed || 0);
  });

  const topDrugs = Object.entries(qtyByDrug)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let y3 = 280;
  doc.setFontSize(10);
  if (topDrugs.length === 0) {
    doc.text("No dispense data available.", 60, y3);
    y3 += 14;
  } else {
    topDrugs.forEach(([name, qty], index) => {
      doc.text(`${index + 1}. ${name}: ${qty} units`, 60, y3);
      y3 += 14;
    });
  }

  // Top 5 departments
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Top 5 Departments by Quantity Dispensed", 400, 260);
  doc.setFont(undefined, "normal");

  const qtyByDept = {};
  dispenses.forEach((r) => {
    const dept = r.department || "Unknown";
    qtyByDept[dept] =
      (qtyByDept[dept] || 0) + (r.quantityDispensed || 0);
  });

  const topDepts = Object.entries(qtyByDept)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let y4 = 280;
  doc.setFontSize(10);
  if (topDepts.length === 0) {
    doc.text("No department data available.", 400, y4);
    y4 += 14;
  } else {
    topDepts.forEach(([dept, qty], index) => {
      doc.text(`${index + 1}. ${dept}: ${qty} units`, 400, y4);
      y4 += 14;
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 80,
      doc.internal.pageSize.getHeight() - 20
    );
  }

  doc.save("dashboard-summary.pdf");
}

  // ++++++++++++++ END OF EXPORT REPORT Dashboard Summary PDF ++++++++++++

  /* ============================================================
  EXPORT REPORT (Custom Range Report PDF) 12 Dec (A4 LANDSCAPE, ALL FILTERED ROWS)
   ============================================================ */
  async function exportCustomRangeReportPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("jsPDF failed to load.");
    return;
  }

  const fromVal = document.getElementById("report-from").value;
  const toVal = document.getElementById("report-to").value;

  if (!fromVal || !toVal) {
    alert("Please select both From and To dates using the report filters.");
    return;
  }

  const fromDate = new Date(fromVal);
  const toDate = new Date(toVal);
  if (isNaN(fromDate) || isNaN(toDate)) {
    alert("Invalid date range selected.");
    return;
  }
  if (toDate < fromDate) {
    alert("The 'To' date cannot be earlier than the 'From' date.");
    return;
  }

  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  const drugs = await getAllDrugs();
  const allDispenses = await getAllDispenses();

  const dispensesInRange = allDispenses.filter((r) => {
    if (!r.dateDispensed) return false;
    const d = new Date(r.dateDispensed);
    if (isNaN(d)) return false;
    return d >= fromDate && d <= toDate;
  });

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  // Logo + App name
  const logoPath = "Resources/Dims 400 x 400.png";
  doc.addImage(logoPath, "PNG", 40, 20, 40, 40);
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Cathy-D", 84, 47);
  doc.setTextColor(0, 128, 0);
  doc.text("i", 153, 47);
  doc.setTextColor(0, 0, 0);
  doc.text("MS", 158, 47);

  // Title
  doc.setFontSize(16);
  doc.setFont(undefined, "normal");
  doc.text("Custom Range Report", 40, 80);

  const now = new Date();
  const datePrepared = formatDateDDMMYYYY(now);
  const timePrepared = now.toLocaleTimeString();
  const rangeText = `${formatDateDDMMYYYY(fromDate)} to ${formatDateDDMMYYYY(toDate)}`;

  doc.setFontSize(10);
  doc.text(`Period: ${rangeText}`, 40, 100);
  doc.text(`Date Prepared: ${datePrepared}`, 400, 100);
  doc.text(`Time: ${timePrepared}`, 400, 115);

  // Summary
  let y = 140;
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Summary", 40, y);
  doc.setFont(undefined, "normal");
  y += 20;

  const totalDispenses = dispensesInRange.length;
  const totalQtyDispensed = dispensesInRange.reduce(
    (sum, r) => sum + (r.quantityDispensed || 0),
    0
  );

  const deptUsage = {};
  dispensesInRange.forEach((r) => {
    const dept = r.department || "Unknown";
    deptUsage[dept] =
      (deptUsage[dept] || 0) + (r.quantityDispensed || 0);
  });

  let topDept = "-";
  let topDeptQty = 0;
  Object.entries(deptUsage).forEach(([dept, qty]) => {
    if (qty > topDeptQty) {
      topDept = dept;
      topDeptQty = qty;
    }
  });

  const drugUsage = {};
  dispensesInRange.forEach((r) => {
    const name = r.drugName || "Unknown";
    drugUsage[name] =
      (drugUsage[name] || 0) + (r.quantityDispensed || 0);
  });

  let topDrug = "-";
  let topDrugQty = 0;
  Object.entries(drugUsage).forEach(([name, qty]) => {
    if (qty > topDrugQty) {
      topDrug = name;
      topDrugQty = qty;
    }
  });

  doc.setFontSize(10);
  doc.text(`Total dispenses in period: ${totalDispenses}`, 60, y); y += 14;
  doc.text(`Total quantity dispensed: ${totalQtyDispensed}`, 60, y); y += 14;
  doc.text(`Top department (by quantity): ${topDept} (${topDeptQty} units)`, 60, y); y += 14;
  doc.text(`Top drug (by quantity): ${topDrug} (${topDrugQty} units)`, 60, y); y += 20;

  // Inventory snapshot
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Inventory Snapshot (Current)", 40, y);
  doc.setFont(undefined, "normal");
  y += 18;

  let inStock = 0;
  let outOfStock = 0;
  let critical = 0;
  let expired = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  drugs.forEach((d) => {
    const qty = d.quantity || 0;
    const crit = d.criticalLevel || 0;
    if (qty === 0) outOfStock++;
    if (qty > 0) inStock++;
    if (qty > 0 && qty <= crit) critical++;

    if (d.expiry && d.expiry.includes("/")) {
      const [day, month, year] = d.expiry.split("/");
      const expDate = new Date(year, month - 1, day);
      expDate.setHours(0, 0, 0, 0);
      if (expDate < today) expired++;
    }
  });

  doc.setFontSize(10);
  doc.text(`Total drugs: ${drugs.length}`, 60, y); y += 14;
  doc.text(`In stock: ${inStock}`, 60, y); y += 14;
  doc.text(`Out of stock: ${outOfStock}`, 60, y); y += 14;
  doc.text(`Critical level: ${critical}`, 60, y); y += 14;
  doc.text(`Expired: ${expired}`, 60, y); y += 20;

  // Inventory table (new page)
  doc.addPage();
  let startY = 60;
  const startX = 40;

  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("Inventory Details (Current)", startX, startY);
  startY += 20;
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");

  const invHeader = [
    "S/N",
    "Name",
    "Class",
    "Subclass",
    "Expiry",
    "Pack",
    "Unit",
    "Qty",
    "Critical",
    "Status",
  ];
  const invColWidths = [35, 110, 80, 80, 70, 60, 70, 50, 55, 70];

  function drawInvHeader(yPos) {
    const totalW = invColWidths.reduce((a, b) => a + b, 0);
    doc.setFillColor(220, 220, 220);
    doc.rect(startX, yPos - 12, totalW, 18, "F");
    doc.setFont(undefined, "bold");
    invHeader.forEach((text, i) => {
      const cellX = startX + invColWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(text, cellX + 4, yPos);
    });
    doc.setFont(undefined, "normal");
  }

  drawInvHeader(startY);
  startY += 15;

  drugs
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((drug, index) => {
      const row = [];
      let status = "Ok";
      if (drug.quantity === 0) status = "OS";
      else if (drug.quantity <= (drug.criticalLevel || 0)) status = "Critical";

      row.push(String(index + 1));
      row.push(drug.name || "-");
      row.push(drug.classification || "-");
      row.push(drug.subClass || "-");
      row.push(drug.expiry || "-");
      row.push(drug.packSize || "-");
      row.push(drug.unit || "-");
      row.push(String(drug.quantity || 0));
      row.push(String(drug.criticalLevel || 0));
      row.push(status);

      const rowY = startY;
      const wrappedRow = row.map((cell, i) =>
        doc.splitTextToSize(String(cell), invColWidths[i] - 8)
      );
      const maxLines = Math.max(...wrappedRow.map((w) => w.length));
      const rowHeight = 15 * maxLines;

      if (index % 2 !== 0) {
        doc.setFillColor(240, 240, 240);
        doc.rect(
          startX,
          rowY - 10,
          invColWidths.reduce((a, b) => a + b, 0),
          rowHeight,
          "F"
        );
      }

      row.forEach((cell, i) => {
        const cellX = startX + invColWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(wrappedRow[i], cellX + 4, rowY);
      });

      startY += rowHeight;

      if (startY > 550) {
        doc.addPage();
        startY = 50;
        drawInvHeader(startY);
        startY += 15;
      }
    });

  // Dispenses in range (new page)
  doc.addPage();
  let dStartY = 60;
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("Dispenses in Selected Period", startX, dStartY);
  dStartY += 20;
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");

  const dispHeader = ["S/N", "Date", "Drug", "Department", "Qty", "Classification"];
  const dispColWidths = [35, 120, 120, 120, 50, 120];

  function drawDispHeader(yPos) {
    const totalW = dispColWidths.reduce((a, b) => a + b, 0);
    doc.setFillColor(220, 220, 220);
    doc.rect(startX, yPos - 12, totalW, 18, "F");
    doc.setFont(undefined, "bold");
    dispHeader.forEach((text, i) => {
      const cellX = startX + dispColWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(text, cellX + 4, yPos);
    });
    doc.setFont(undefined, "normal");
  }

  drawDispHeader(dStartY);
  dStartY += 15;

  dispensesInRange
    .sort((a, b) => new Date(a.dateDispensed) - new Date(b.dateDispensed))
    .forEach((r, index) => {
      const d = r.dateDispensed ? new Date(r.dateDispensed) : null;
      const displayDate = d
        ? `${formatDateDDMMYYYY(d)} ${d.toLocaleTimeString()}`
        : "-";

      const row = [
        String(index + 1),
        displayDate,
        r.drugName || "-",
        r.department || "-",
        String(r.quantityDispensed || 0),
        r.classification || "-",
      ];

      const rowY = dStartY;
      const wrappedRow = row.map((cell, i) =>
        doc.splitTextToSize(String(cell), dispColWidths[i] - 8)
      );
      const maxLines = Math.max(...wrappedRow.map((w) => w.length));
      const rowHeight = 15 * maxLines;

      if (index % 2 !== 0) {
        doc.setFillColor(240, 240, 240);
        doc.rect(
          startX,
          rowY - 10,
          dispColWidths.reduce((a, b) => a + b, 0),
          rowHeight,
          "F"
        );
      }

      row.forEach((cell, i) => {
        const cellX = startX + dispColWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(wrappedRow[i], cellX + 4, rowY);
      });

      dStartY += rowHeight;

      if (dStartY > 550) {
        doc.addPage();
        dStartY = 50;
        drawDispHeader(dStartY);
        dStartY += 15;
      }
    });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 80,
      doc.internal.pageSize.getHeight() - 20
    );
  }

  doc.save("custom-range-report.pdf");
}
  // ++++++++++++++ END OF EXPORT REPORT Dashboard Summary PDF ++++++++++++
  

/* ============================================================
   EXPORT INVENTORY TO EXCEL (CSV WITH SERIAL NUMBERS)
   ============================================================ */
async function exportInventoryToExcel() {
  const drugs = await getAllDrugs();

  let csv =
    "S/N,Name,Classification,SubClass,Expiry,PackSize,Unit,Quantity,CriticalLevel,Status\n";

  let sn = 1;
  drugs.forEach((drug) => {
    const isCritical = drug.quantity <= (drug.criticalLevel || 0);
    const statusText = isCritical ? "Critical" : "OK";

    const values = [
      sn++,
      drug.name || "—",
      drug.classification || "—",
      drug.subClass || "—",
      drug.expiry || "—",
      drug.packSize || "—",
      drug.unit || "—",
      drug.quantity,
      drug.criticalLevel || 0,
      statusText,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

    csv += values.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   IMPORT INVENTORY FROM EXCEL (CSV WITH HEADER VALIDATION)
   ============================================================ */
async function importInventoryCSV(fullImport = false) {
  const fileInput = document.getElementById("excel-inventory-input");
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select an Inventory CSV file first.");
    return;
  }

  const text = await file.text();
  const rows = text.trim().split("\n").map(r => r.split(","));

  const expectedHeader = ["S/N","Name","Classification","SubClass","Expiry","PackSize","Unit","Quantity","CriticalLevel","Status"];
  const headerRow = rows[0].map(h => h.replace(/"/g, "").trim());
  const isValidHeader = expectedHeader.every((col, i) => headerRow[i] === col);
  if (!isValidHeader) {
    alert("Invalid Inventory CSV format. Expected header: " + expectedHeader.join(", "));
    return;
  }

  const dataRows = rows.slice(1);
  const drugs = [];

  for (const row of dataRows) {
    const [, name, classification, subClass, expiry, packSize, unit, qty, criticalLevel] = row.map(v => v.replace(/"/g, "").trim());
    drugs.push({
      name,
      classification,
      subClass,
      expiry,
      packSize,
      unit,
      quantity: Number(qty),
      criticalLevel: Number(criticalLevel),
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
  }

  const tx = db.transaction("drugs", "readwrite");
  const drugStore = tx.objectStore("drugs");

  if (fullImport) await drugStore.clear();
  for (const drug of drugs) drugStore.put(drug);

  alert("Inventory import completed successfully.");
  await refreshInventoryTable();
  await refreshDispenseDrugOptions();
}

/* ============================================================
   EXPORT DISPENSES TO EXCEL (CSV WITH SERIAL NUMBERS)
   ============================================================ */
async function exportDispensesToExcel() {
  const dispenses = await getAllDispenses();

  let csv =
    "S/N,DateDispensed,DrugName,Classification,SubClass,Expiry,DrugUnit,QuantityDispensed,Department,ApprovedBy\n";

  let sn = 1;
  dispenses.forEach((r) => {
    const values = [
      sn++,
      r.dateDispensed ? new Date(r.dateDispensed).toLocaleString() : "—",
      r.drugName || "—",
      r.classification || "—",
      r.subClass || "—",
      r.expiry || "—",
      r.drugUnit || "—",
      r.quantityDispensed || "—",
      r.department || "—",
      r.approvedBy || "—",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

    csv += values.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dispenses.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   IMPORT DISPENSES FROM EXCEL (CSV WITH HEADER VALIDATION)
   ============================================================ */
async function importDispensesCSV(fullImport = false) {
  const fileInput = document.getElementById("excel-dispenses-input");
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a Dispenses CSV file first.");
    return;
  }

  const text = await file.text();
  const rows = text.trim().split("\n").map(r => r.split(","));

  const expectedHeader = ["S/N","DateDispensed","DrugName","Classification","SubClass","Expiry","DrugUnit","QuantityDispensed","Department","ApprovedBy"];
  const headerRow = rows[0].map(h => h.replace(/"/g, "").trim());
  const isValidHeader = expectedHeader.every((col, i) => headerRow[i] === col);
  if (!isValidHeader) {
    alert("Invalid Dispenses CSV format. Expected header: " + expectedHeader.join(", "));
    return;
  }

  const dataRows = rows.slice(1);
  const dispenses = [];

  for (const row of dataRows) {
    const [, dateDispensed, drugName, classification, subClass, expiry, drugUnit, qtyDispensed, department, approvedBy] = row.map(v => v.replace(/"/g, "").trim());
    dispenses.push({
      dateDispensed,
      drugName,
      classification,
      subClass,
      expiry,
      drugUnit,
      quantityDispensed: Number(qtyDispensed),
      department,
      approvedBy
    });
  }

  const tx = db.transaction("dispenses", "readwrite");
  const dispStore = tx.objectStore("dispenses");

  if (fullImport) await dispStore.clear();
  for (const disp of dispenses) dispStore.put(disp);

  alert("Dispenses import completed successfully.");
  await refreshDispenseTable();
}

/* ============================================================
   BACKUP / EXPORT (JSON)
   ============================================================ */
async function exportBackup() {
  const drugs = await getAllDrugs();
  const dispenses = await getAllDispenses();
  const pin = getCurrentPin();
  const theme = localStorage.getItem(THEME_STORAGE_KEY) || "light";

  const backup = {
    meta: {
      version: "1.1.0",
      exportedAt: new Date().toISOString(),
    },
    settings: { pin, theme },
    drugs,
    dispenses,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `drugs_inventory_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   RESTORE (FULL + MERGE) FROM JSON BACKUP
   ============================================================ */
async function restoreBackup(fullRestore = false) {
  const fileInput = document.getElementById("backup-file-input");
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a backup file first.");
    return;
  }

  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    alert("Invalid backup file.");
    return;
  }

  if (!data.drugs || !data.dispenses) {
    alert("Backup file is missing required data.");
    return;
  }

  const confirmMsg = fullRestore
    ? "This will DELETE all current data and replace it with the backup. Continue?"
    : "This will MERGE backup data with existing data. Continue?";
  if (!confirm(confirmMsg)) return;

  const tx = db.transaction(["drugs", "dispenses"], "readwrite");
  const drugStore = tx.objectStore("drugs");
  const dispStore = tx.objectStore("dispenses");

  if (fullRestore) {
    await drugStore.clear();
    await dispStore.clear();
  }

  for (const drug of data.drugs) drugStore.put(drug);
  for (const disp of data.dispenses) dispStore.put(disp);

  // Restore settings
  if (data.settings) {
    if (data.settings.pin) setCurrentPin(data.settings.pin);
    if (data.settings.theme) applyTheme(data.settings.theme);
  }

  alert("Restore completed successfully.");

  await refreshInventoryTable();
  await refreshDispenseTable();
  await refreshDispenseDrugOptions();
  await updateReports();
}



/* ============================================================
   PWA SERVICE WORKER REGISTRATION
   ============================================================ */

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) =>
        console.error("Service worker registration failed:", err)
      );
  }
}

/* ============================================================
   INITIALIZATION (DOMContentLoaded callback)
   ============================================================ */

// document.addEventListener("DOMContentLoaded", async () => {
//   await openDatabase();
//   initTabs();
//   initThemeToggle();
//   initInventory();
//   initIncrementModal();
//   initDeleteModal();   // <-- add this
//   initEditModal();   // <-- add this
//   initDispense();
//   initReports();
//   initSettings();
//   registerServiceWorker();

/* ============================================================
   INITIALIZATION (DOMContentLoaded callback)
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  await openDatabase();
  initTabs();
  initThemeToggle();
  initInventory();
  initIncrementModal();
  initDeleteModal();   // <-- add this
  initEditModal();     // <-- add this
  initDispense();
  initReports();

  try {
    initSettings();
    // Call loader after DB is ready
    await loadReportInfoIntoSettings();
  } catch (e) {
    console.error("Settings initialization failed:", e);
  }

  registerServiceWorker();



  /* ============================================================
   SETTINGS BUTTON HOOKUPS
   ============================================================ */

  // Save buttons for Facility Name + Prepared By
    document.getElementById("settings-save-report-info").addEventListener("click", async () => {
      const facilityName = document.getElementById("settings-facility-name").value.trim();
      const preparedBy = document.getElementById("settings-prepared-by").value.trim();

      await saveReportInfo(facilityName, preparedBy);
      alert("Report information saved.");
  });

// Inventory Excel (CSV)
document.getElementById("btn-export-inventory")
  .addEventListener("click", exportInventoryToExcel);
document.getElementById("btn-import-inventory-full")
  .addEventListener("click", () => importInventoryCSV(true));
document.getElementById("btn-import-inventory-merge")
  .addEventListener("click", () => importInventoryCSV(false));

// Dispenses Excel (CSV)
document.getElementById("btn-export-dispenses")
  .addEventListener("click", exportDispensesToExcel);
document.getElementById("btn-import-dispenses-full")
  .addEventListener("click", () => importDispensesCSV(true));
document.getElementById("btn-import-dispenses-merge")
  .addEventListener("click", () => importDispensesCSV(false));

  // Backup Excel (CSV) JSON/Restore buttons
  document
    .getElementById("btn-backup-export")
    .addEventListener("click", exportBackup);

  document
    .getElementById("btn-restore-full")
    .addEventListener("click", () => restoreBackup(true));

  document
    .getElementById("btn-restore-merge")
    .addEventListener("click", () => restoreBackup(false));
});



