document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || "Đăng nhập thất bại");

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    localStorage.setItem("full_name", data.full_name);
    localStorage.setItem("role", data.role);
    localStorage.setItem("id", data.id);
    console.log('LOGIN DATA:', data);
    localStorage.setItem('branch_id', data.branch_id);


    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "index.html";
    }
  } catch (err) {
    document.getElementById("loginError").textContent = err.message;
  }
});
