const components = {
    // Reusable checkbox filter dropdown
    createCheckboxFilterDropdown: ({ items, getSelected, setSelected, getSearchText, setSearchText, placeholder, emptyText, onChange, showSearch = true, listMode = 'selectedOnlyDefault' }) => {
        const dropdown = document.createElement("div");
        dropdown.className = "dropdown-menu";

        // Controls section (only show if we have controls to show)
        const hasControls = true; // Always show Clear All for now
        if (hasControls) {
            const controls = document.createElement("div");
            controls.className = "dropdown-controls";

            const clearAllBtn = document.createElement("button");
            clearAllBtn.className = "dropdown-clear-btn";
            clearAllBtn.textContent = "Clear All";
            clearAllBtn.addEventListener("click", () => {
                if (showSearch) {
                    setSearchText("");
                    searchInput.value = "";
                }
                setSelected([]);
                onChange();
                renderCheckboxes();
            });
            controls.appendChild(clearAllBtn);
            dropdown.appendChild(controls);
        }

        // Search input
        let searchInput = null;
        if (showSearch) {
            searchInput = document.createElement("input");
            searchInput.type = "text";
            searchInput.className = "dropdown-search";
            searchInput.placeholder = placeholder;
            searchInput.value = getSearchText();
            dropdown.appendChild(searchInput);
        }

        function renderCheckboxes() {
            // Remove previous items
            Array.from(dropdown.querySelectorAll(".dropdown-item, .dropdown-empty")).forEach(el => el.remove());

            const query = (showSearch && searchInput) ? searchInput.value.toLowerCase() : "";
            const allItems = items();
            const selected = getSelected();

            let itemsToRender;
            if (listMode === 'allWithSelectedFirst') {
                itemsToRender = [...allItems]
                    .sort((a, b) => {
                        const aSel = selected.includes(a);
                        const bSel = selected.includes(b);
                        if (aSel && !bSel) return -1;
                        if (!aSel && bSel) return 1;
                        return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
                    });
            } else {
                // selectedOnlyDefault
                itemsToRender = [...allItems];
                if (!query) {
                    itemsToRender = itemsToRender.filter(v => selected.includes(v));
                } else {
                    itemsToRender = itemsToRender.filter(
                        v => String(v).toLowerCase().includes(query) || selected.includes(v)
                    );
                }
            }

            // Show empty state if no items
            if (itemsToRender.length === 0) {
                const empty = document.createElement("div");
                empty.className = "dropdown-empty";
                empty.textContent = emptyText;
                dropdown.appendChild(empty);
                return;
            }

            // Render items
            itemsToRender.forEach(value => {
                const label = document.createElement("label");
                label.className = "dropdown-item";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "dropdown-checkbox";
                checkbox.value = value;
                checkbox.checked = selected.includes(value);

                checkbox.addEventListener("change", () => {
                    let next = getSelected();
                    if (checkbox.checked && !next.includes(value)) {
                        next = [...next, value];
                    } else {
                        next = next.filter(v => v !== value);
                    }
                    setSelected(next);
                    onChange();
                    renderCheckboxes();
                });

                const text = document.createElement("span");
                text.className = "dropdown-item-text";
                text.textContent = value;

                label.appendChild(checkbox);
                label.appendChild(text);
                dropdown.appendChild(label);
            });
        }

        // Handle search input events
        let isDragging = false;
        if (showSearch && searchInput) {
            searchInput.addEventListener("mousedown", () => { isDragging = true; });
            document.addEventListener("mouseup", () => { setTimeout(() => isDragging = false, 0); });
            searchInput.addEventListener("input", () => {
                setSearchText(searchInput.value);
                renderCheckboxes();
            });
        }

        // Initial render
        renderCheckboxes();

        return {
            container: dropdown,
            searchInput,
            render: renderCheckboxes,
            open: () => {
                if (showSearch && searchInput) {
                    setSearchText("");
                    searchInput.value = "";
                    renderCheckboxes();
                    setTimeout(() => searchInput.focus(), 0);
                }
            },
            isDragging: () => isDragging,
        };
    }
};

export default components;