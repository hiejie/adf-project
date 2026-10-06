    const tabButtons = document.querySelectorAll(".tab-btn");
    const panels = { registrations: document.getElementById("panel-registrations"), messages: document.getElementById("panel-messages") };

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabButtons.forEach((b) => b.classList.remove("active"));
        Object.values(panels).forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        panels[btn.dataset.tab].classList.add("active");
      });
    });

    function escapeHtml(str) {
      return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[c]));
    }

    function formatDate(iso) {
      try {
        return new Date(iso + "Z").toLocaleString();
      } catch {
        return iso;
      }
    }

    async function loadRegistrations(search = "") {
      const wrap = document.getElementById("regTableWrap");
      const url = "/admin/api/registrations" + (search ? "?search=" + encodeURIComponent(search) : "");
      const res = await fetch(url);
      const rows = await res.json();

      if (!rows.length) {
        wrap.innerHTML = '<div class="empty-state">No registrations yet.</div>';
        return;
      }

      wrap.innerHTML = `
        <table>
          <thead><tr>
            <th>Name</th><th>Email</th><th>Student #</th><th>Screenshot</th><th>Registered</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr data-id="${r.id}">
                <td>${escapeHtml(r.full_name)}</td>
                <td>${escapeHtml(r.email)}</td>
                <td>${escapeHtml(r.student_number)}</td>
                <td><a class="link-btn" href="/admin/screenshots/${encodeURIComponent(r.screenshot_filename)}" target="_blank" rel="noopener">View</a></td>
                <td>${formatDate(r.created_at)}</td>
                <td><button class="action-btn danger" data-action="delete-reg" data-id="${r.id}">Delete</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    async function loadMessages() {
      const wrap = document.getElementById("msgTableWrap");
      const res = await fetch("/admin/api/messages");
      const rows = await res.json();

      if (!rows.length) {
        wrap.innerHTML = '<div class="empty-state">No messages yet.</div>';
        return;
      }

      wrap.innerHTML = `
        <table>
          <thead><tr>
            <th>Status</th><th>From</th><th>Subject</th><th>Message</th><th>Received</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map((m) => `
              <tr data-id="${m.id}">
                <td><span class="pill ${m.is_read ? "read" : "unread"}">${m.is_read ? "Read" : "Unread"}</span></td>
                <td>${escapeHtml(m.name)}<br><span style="color:var(--muted); font-size:0.78rem;">${escapeHtml(m.email)}</span></td>
                <td>${escapeHtml(m.subject)}</td>
                <td class="msg-body">${escapeHtml(m.message)}</td>
                <td>${formatDate(m.created_at)}</td>
                <td>
                  ${m.is_read ? "" : `<button class="action-btn neutral" data-action="mark-read" data-id="${m.id}">Mark read</button>`}
                  <button class="action-btn danger" data-action="delete-msg" data-id="${m.id}">Delete</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    document.getElementById("regSearch").addEventListener("input", (e) => {
      loadRegistrations(e.target.value.trim());
    });

    document.addEventListener("click", async (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      const id = e.target.dataset.id;

      if (action === "delete-reg") {
        if (!confirm("Delete this registration? This also removes the uploaded screenshot.")) return;
        await fetch("/admin/api/registrations/" + id, { method: "DELETE" });
        loadRegistrations(document.getElementById("regSearch").value.trim());
      }

      if (action === "delete-msg") {
        if (!confirm("Delete this message?")) return;
        await fetch("/admin/api/messages/" + id, { method: "DELETE" });
        loadMessages();
      }

      if (action === "mark-read") {
        await fetch("/admin/api/messages/" + id + "/read", { method: "POST" });
        loadMessages();
      }
    });

    loadRegistrations();
    loadMessages();

    document.getElementById("purgeBtn").addEventListener("click", async () => {
      const dateInput = document.getElementById("purgeBefore");
      const statusEl = document.getElementById("purgeStatus");
      const before = dateInput.value;

      if (!before) {
        statusEl.textContent = "Pick a date first.";
        statusEl.className = "retention-status error";
        return;
      }

      if (!confirm(
        `Permanently delete every registration (and screenshot) created before ${before}? ` +
        `This cannot be undone.`
      )) {
        return;
      }

      try {
        const res = await fetch("/admin/api/purge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ before }),
        });
        const data = await res.json();

        if (!res.ok) {
          statusEl.textContent = data.error || "Something went wrong.";
          statusEl.className = "retention-status error";
          return;
        }

        statusEl.textContent = `Deleted ${data.deletedCount} registration(s).`;
        statusEl.className = "retention-status success";
        loadRegistrations(document.getElementById("regSearch").value.trim());
      } catch (err) {
        statusEl.textContent = "Could not reach the server.";
        statusEl.className = "retention-status error";
      }
    });
