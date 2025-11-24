document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("id");

  if (!token || !userId) {
    alert("Bạn chưa đăng nhập");
    window.location.href = "login.html";
    return;
  }

  // Gọi API lấy thông tin user
  try {
    const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) throw new Error("Không tải được thông tin người dùng");
    const user = await res.json();

    // Cập nhật avatar + thông tin chung
    const avatar = user.avatar_url && user.avatar_url.trim() !== '' 
      ? user.avatar_url 
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || "User")}&background=random&color=fff&size=120`;

    document.getElementById('profileAvatar').src = avatar;
    document.getElementById('profileFullname').textContent = user.full_name || "Người dùng DNSE";
    document.getElementById('profileEmail').textContent = user.email || "...";

    // Cập nhật chi tiết thông tin
    document.getElementById('detailEmployeeId').textContent = user.id || '...';
    document.getElementById('detailFullname').textContent = user.full_name || '...';
    document.getElementById('detailEmail').textContent = user.email || '...';
    document.getElementById('detailDepartment').textContent = user.department || '...';
    document.getElementById('detailBranch').textContent = user.branch_name || '...';
    document.getElementById('detailJobTitle').textContent = user.job_title || '...';

  } catch (err) {
    console.error("Lỗi tải thông tin:", err);
  }

  // Đổi mật khẩu
//   document.getElementById("btnChangePassword").addEventListener("click", async () => {
//     const oldPass = document.getElementById("oldPassword").value;
//     const newPass = document.getElementById("newPassword").value;

//     const res = await fetch(`/api/users/change-password/${userId}`, {
//       method: "PUT",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ old_password: oldPass, new_password: newPass })
//     });

//     const data = await res.text();
//     alert(data);
//   });
const changeBtn = document.getElementById("btnChangePassword");
if (changeBtn) {
  changeBtn.addEventListener("click", async () => {
    const oldPass = document.getElementById("oldPassword").value.trim();
    const newPass = document.getElementById("newPassword").value.trim();

    if (!oldPass || !newPass) {
      alert("Vui lòng nhập mật khẩu cũ và mật khẩu mới");
      return;
    }
    if (newPass.length < 6) {
    alert("Mật khẩu mới phải ít nhất 6 ký tự");
    return;
    }


    try {
      const userId = localStorage.getItem("id");
      const res = await fetch(`/api/change-password/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password: oldPass, new_password: newPass })
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Đổi mật khẩu thành công");
        document.getElementById("oldPassword").value = "";
        document.getElementById("newPassword").value = "";
      } else {
        alert(data.error || "Đổi mật khẩu thất bại");
      }

    } catch (err) {
      console.error("Lỗi khi đổi mật khẩu:", err);
      alert("Lỗi server, vui lòng thử lại sau");
    }
  });
}

});
