(function () {
  "use strict";

  const data = window.APP_DATA;
  const screens = [...document.querySelectorAll("[data-screen]")];
  const backButton = document.querySelector("[data-back]");
  const appBarTitle = document.querySelector(".app-bar-title");
  const qualityVendorInput = document.querySelector("#quality-vendor");
  const qualityVendorDropdown = document.querySelector("#quality-vendor-dropdown");
  const qualityVendorOptions = document.querySelector("#quality-vendor-options");
  const qualityVendorEmpty = document.querySelector("#quality-vendor-empty");
  const qualitySearchStatus = document.querySelector("#quality-search-status");
  const contractVendorSelect = document.querySelector("#contract-vendor");
  const qualityLegend = document.querySelector("#quality-legend");
  const qualityResults = document.querySelector("#quality-results");
  const contractResults = document.querySelector("#contract-results");
  const contractSummary = document.querySelector("#contract-summary");
  const conductorGuideButton = document.querySelector("#conductor-guide-button");
  const conductorGuideDialog = document.querySelector("#conductor-guide-dialog");
  const conductorGuidePanel = conductorGuideDialog?.querySelector(".guide-dialog");
  const conductorGuideClose = document.querySelector("#conductor-guide-close");
  const installButton = document.querySelector("#install-button");
  const fatalError = document.querySelector("#fatal-error");
  const toast = document.querySelector("#toast");

  let selectedYear = 2025;
  let deferredInstallPrompt = null;
  let toastTimer = null;
  let conductorGuideReturnFocus = null;
  let selectedQualityVendor = "";
  let filteredQualityVendors = [];
  let activeQualityOption = -1;

  if (!data || !Array.isArray(data.quality) || !Array.isArray(data.contracts)) {
    fatalError.hidden = false;
    document.querySelector("#app-main").querySelectorAll(".screen").forEach((screen) => (screen.hidden = true));
    return;
  }

  const qualityVendors = uniqueSorted(data.quality.map((row) => row.vendor));

  refreshContractVendors();

  function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ko"));
  }

  function normalizeVendor(value) {
    return value.normalize("NFC").toLowerCase().replace(/\s|\(주\)|㈜|주식회사/g, "");
  }

  function vendorMatches(vendor, query) {
    const name = normalizeVendor(vendor);
    const search = normalizeVendor(query);
    const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
    // Match each initial against a Hangul syllable, also allowing mixed text such as "대한ㅈ".
    for (let start = 0; start <= name.length - search.length; start += 1) {
      if ([...search].every((character, offset) => {
        const letter = name[start + offset];
        const syllable = letter.charCodeAt(0) - 0xac00;
        return character === letter || (syllable >= 0 && syllable < 11172 &&
          character === initials[Math.floor(syllable / 588)]);
      })) return true;
    }
    return false;
  }

  function closeQualityOptions() {
    qualityVendorDropdown.hidden = true;
    qualityVendorInput.setAttribute("aria-expanded", "false");
    qualityVendorInput.removeAttribute("aria-activedescendant");
    activeQualityOption = -1;
  }

  function showQualityOptions() {
    filteredQualityVendors = qualityVendors.filter((vendor) => vendorMatches(vendor, qualityVendorInput.value));
    activeQualityOption = -1;
    qualityVendorInput.removeAttribute("aria-activedescendant");
    const fragment = document.createDocumentFragment();
    filteredQualityVendors.forEach((vendor, index) => {
      const option = document.createElement("li");
      option.id = `quality-vendor-option-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.dataset.index = String(index);
      option.textContent = vendor;
      fragment.appendChild(option);
    });
    qualityVendorOptions.replaceChildren(fragment);
    qualityVendorEmpty.hidden = filteredQualityVendors.length > 0;
    qualityVendorDropdown.hidden = false;
    qualityVendorInput.setAttribute("aria-expanded", "true");
    qualitySearchStatus.textContent = filteredQualityVendors.length
      ? `${filteredQualityVendors.length}개 업체가 검색되었습니다.` : "검색 결과가 없습니다.";
  }

  function chooseQualityVendor(index) {
    const vendor = filteredQualityVendors[index];
    if (!vendor) return;
    selectedQualityVendor = vendor;
    qualityVendorInput.value = vendor;
    qualityVendorInput.focus({ preventScroll: true });
    closeQualityOptions();
    qualitySearchStatus.textContent = `${vendor} 선택됨`;
    renderQuality();
  }

  qualityVendorInput.addEventListener("input", () => {
    selectedQualityVendor = "";
    renderQuality();
    showQualityOptions();
  });
  qualityVendorInput.addEventListener("focus", showQualityOptions);
  qualityVendorInput.addEventListener("click", showQualityOptions);
  qualityVendorInput.addEventListener("blur", closeQualityOptions);
  // Keep focus in the combobox until the option click has selected a vendor.
  qualityVendorOptions.addEventListener("mousedown", (event) => event.preventDefault());
  qualityVendorOptions.addEventListener("click", (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) chooseQualityVendor(Number(option.dataset.index));
  });
  qualityVendorInput.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape" || event.key === "Tab") {
      closeQualityOptions();
      return;
    }
    if (event.key === "Enter" && !qualityVendorDropdown.hidden) {
      event.preventDefault();
      if (activeQualityOption >= 0) chooseQualityVendor(activeQualityOption);
      else if (filteredQualityVendors.length === 1) chooseQualityVendor(0);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (qualityVendorDropdown.hidden) showQualityOptions();
    const count = filteredQualityVendors.length;
    if (!count) return;
    activeQualityOption = activeQualityOption < 0
      ? (event.key === "ArrowDown" ? 0 : count - 1)
      : (activeQualityOption + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
    [...qualityVendorOptions.children].forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === activeQualityOption));
    });
    const active = qualityVendorOptions.children[activeQualityOption];
    qualityVendorInput.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  });

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
    closeQualityOptions();
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

  function createGrade(value, year) {
    const grade = document.createElement("span");
    const isGrade = ["S", "A", "B", "C"].includes(value);
    const label = value || "-";
    grade.className = isGrade ? `grade grade-${value.toLowerCase()}` : "grade grade-na grade-note";
    grade.textContent = label;
    grade.setAttribute("aria-label", `${year}년 ${label}${isGrade ? " 등급" : ""}`);
    return grade;
  }

  function renderQuality() {
    const vendor = selectedQualityVendor;
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
      item.append(group, createGrade(row.grade2025, 2025), createGrade(row.grade2024, 2024));
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

  function openConductorGuide() {
    if (!conductorGuideDialog) return;
    conductorGuideReturnFocus = document.activeElement;
    conductorGuideDialog.hidden = false;
    document.body.classList.add("guide-open");
    conductorGuidePanel?.focus({ preventScroll: true });
  }

  function closeConductorGuide() {
    if (!conductorGuideDialog || conductorGuideDialog.hidden) return;
    conductorGuideDialog.hidden = true;
    document.body.classList.remove("guide-open");
    conductorGuideReturnFocus?.focus({ preventScroll: true });
  }

  conductorGuideButton?.addEventListener("click", openConductorGuide);
  conductorGuideClose?.addEventListener("click", closeConductorGuide);

  conductorGuideDialog?.addEventListener("click", (event) => {
    if (event.target === conductorGuideDialog) closeConductorGuide();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeConductorGuide();
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
      navigator.serviceWorker.register("./sw.js?v=1.0.13", { updateViaCache: "none" }).catch(() => {
        showToast("오프라인 준비에 실패했습니다. 새로고침해 주세요.");
      });
    });
  }

  showRoute(currentRoute());
})();
