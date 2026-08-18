(function () {
  "use strict";

  const data = window.APP_DATA;
  const screens = [...document.querySelectorAll("[data-screen]")];
  const backButton = document.querySelector("[data-back]");
  const appBarTitle = document.querySelector(".app-bar-title");
  const qualityVendorSelect = document.querySelector("#quality-vendor");
  const contractVendorSelect = document.querySelector("#contract-vendor");
  const qualityLegend = document.querySelector("#quality-legend");
  const qualityResults = document.querySelector("#quality-results");
  const contractResults = document.querySelector("#contract-results");
  const contractSummary = document.querySelector("#contract-summary");
  const conductorGuideButton = document.querySelector("#conductor-guide-button");
  const conductorGuideDialog = document.querySelector("#conductor-guide-dialog");
  const conductorGuideClose = document.querySelector("#conductor-guide-close");
  const installButton = document.querySelector("#install-button");
  const fatalError = document.querySelector("#fatal-error");
  const toast = document.querySelector("#toast");

  let selectedYear = 2025;
  let deferredInstallPrompt = null;
  let toastTimer = null;

  if (!data || !Array.isArray(data.quality) || !Array.isArray(data.contracts)) {
    fatalError.hidden = false;
    document.querySelector("#app-main").querySelectorAll(".screen").forEach((screen) => (screen.hidden = true));
    return;
  }

  const qualityVendors = uniqueSorted(data.quality.map((row) => row.vendor));

  populateSelect(qualityVendorSelect, qualityVendors, "", "선택하세요");
  refreshContractVendors();

  function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ko"));
  }

  function populateSelect(select, values, selected, placeholder = "") {
    const fragment = document.createDocumentFragment();

    if (placeholder) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = placeholder;
      option.disabled = true;
      option.selected = !selected;
      fragment.appendChild(option);
    }

    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === selected;
      fragment.appendChild(option);
    });
    select.replaceChildren(fragment);
  }

  function refreshContractVendors() {
    const vendors = uniqueSorted(
      data.contracts.filter((row) => row.year === selectedYear).map((row) => row.vendor),
    );
    const currentVendor = contractVendorSelect.value;
    const nextVendor = vendors.includes(currentVendor) ? currentVendor : "";
    populateSelect(contractVendorSelect, vendors, nextVendor, "선택하세요");
    renderContracts();
  }

  function currentRoute() {
    const route = location.hash.replace(/^#/, "");
    return route === "quality" || route === "contract" ? route : "home";
  }

  function showRoute(route, focusHeading = false) {
    screens.forEach((screen) => {
      screen.hidden = screen.dataset.screen !== route;
    });
    const home = route === "home";
    backButton.hidden = home;
    appBarTitle.textContent = home ? "품질·계약저항 조회" : route === "quality" ? "품질등급" : "계약저항";
    if (route === "quality") renderQuality();
    if (route === "contract") renderContracts();
    window.scrollTo({ top: 0, behavior: "instant" });
    if (focusHeading) document.querySelector(`[data-screen="${route}"] h1`)?.focus({ preventScroll: true });
  }

  function navigate(route) {
    const nextHash = route === "home" ? "" : `#${route}`;
    if (location.hash === nextHash) showRoute(route, true);
    else location.hash = nextHash;
  }

  function createGrade(value) {
    const grade = document.createElement("span");
    const normalized = ["S", "A", "B", "C"].includes(value) ? value : "-";
    grade.className = `grade grade-${normalized === "-" ? "na" : normalized.toLowerCase()}`;
    grade.textContent = normalized;
    grade.setAttribute("aria-label", `${normalized} 등급`);
    return grade;
  }

  function renderQuality() {
    const vendor = qualityVendorSelect.value;
    qualityLegend.hidden = !vendor;

    if (!vendor) {
      qualityResults.replaceChildren();
      return;
    }

    const rows = data.quality.filter((row) => row.vendor === vendor);
    const fragment = document.createDocumentFragment();

    rows.forEach((row) => {
      const item = document.createElement("article");
      item.className = "quality-row";
      const group = document.createElement("strong");
      group.textContent = row.group;
      item.append(group, createGrade(row.grade2024), createGrade(row.grade2023));
      fragment.appendChild(item);
    });

    qualityResults.replaceChildren(fragment);
  }

  function renderContracts() {
    const vendor = contractVendorSelect.value;
    contractResults.replaceChildren();

    if (!vendor) {
      contractSummary.textContent = "";
      return;
    }

    const rows = data.contracts.filter((row) => row.vendor === vendor && row.year === selectedYear);

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "선택한 업체와 연도에 해당하는 계약저항 자료가 없습니다.";
      contractResults.appendChild(empty);
      contractSummary.textContent = `${vendor} · ${selectedYear}년 · 조회 결과 없음`;
      return;
    }

    const groupMap = new Map();
    rows.forEach((row) => {
      if (!groupMap.has(row.group)) groupMap.set(row.group, []);
      groupMap.get(row.group).push(row);
    });

    const fragment = document.createDocumentFragment();
    [...groupMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "ko"))
      .forEach(([groupName, groupRows]) => {
        const section = document.createElement("section");
        section.className = "contract-group";
        const heading = document.createElement("h2");
        heading.textContent = groupName;
        section.appendChild(heading);

        groupRows
          .sort((a, b) => a.specSq - b.specSq)
          .forEach((row) => {
            const item = document.createElement("div");
            item.className = "resistance-row";
            const spec = document.createElement("span");
            spec.className = "resistance-spec";
            spec.textContent = `${row.specSq}SQ`;

            const details = document.createElement("div");
            details.className = "resistance-details";
            const detailKey = `${row.year}|${row.vendor}|${row.group}|${row.specSq}`;
            const numberMap = data.contractNumbers?.[detailKey] || {};

            row.resistances.forEach((value) => {
              const entry = document.createElement("div");
              entry.className = "resistance-entry";
              const resistance = document.createElement("strong");
              resistance.textContent = value;
              entry.appendChild(resistance);

              const contractNumbers = numberMap[value] || [];
              if (contractNumbers.length) {
                const numberLine = document.createElement("small");
                numberLine.className = "contract-numbers";
                numberLine.textContent = `계약번호 ${contractNumbers.join(" · ")}`;
                entry.appendChild(numberLine);
              }

              details.appendChild(entry);
            });

            item.append(spec, details);
            section.appendChild(item);
          });
        fragment.appendChild(section);
      });

    contractResults.appendChild(fragment);
    contractSummary.textContent = `${vendor} · ${selectedYear}년 · ${groupMap.size}개 품목 · ${rows.length}개 규격`;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => (toast.hidden = true), 2600);
  }

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });

  backButton.addEventListener("click", () => navigate("home"));
  window.addEventListener("hashchange", () => showRoute(currentRoute(), true));

  qualityVendorSelect.addEventListener("change", () => {
    renderQuality();
  });

  contractVendorSelect.addEventListener("change", () => {
    renderContracts();
  });

  document.querySelectorAll("[data-year]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedYear = Number(button.dataset.year);
      document.querySelectorAll("[data-year]").forEach((yearButton) => {
        yearButton.setAttribute("aria-pressed", String(yearButton === button));
      });
      refreshContractVendors();
    });
  });

  conductorGuideButton.addEventListener("click", () => {
    if (typeof conductorGuideDialog.showModal === "function") conductorGuideDialog.showModal();
    else conductorGuideDialog.setAttribute("open", "");
  });

  function closeConductorGuide() {
    if (typeof conductorGuideDialog.close === "function") conductorGuideDialog.close();
    else conductorGuideDialog.removeAttribute("open");
  }

  conductorGuideClose.addEventListener("click", closeConductorGuide);

  conductorGuideDialog.addEventListener("click", (event) => {
    if (event.target === conductorGuideDialog) closeConductorGuide();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") showToast("앱 설치를 시작합니다.");
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener("appinstalled", () => showToast("앱 설치가 완료되었습니다."));

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        showToast("오프라인 준비에 실패했습니다. 새로고침해 주세요.");
      });
    });
  }

  showRoute(currentRoute());
})();
