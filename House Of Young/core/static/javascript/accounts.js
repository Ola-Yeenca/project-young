document.addEventListener('DOMContentLoaded', () => {
  console.log("Accounts js loaded")
  document.querySelector('#login-form').onsubmit = () => {
    const username = document.querySelector('#username').value;
    const password = document.querySelector('#password').value;

    fetch('/login', {
      method: 'POST',
      body: JSON.stringify({
        username: username,
        password: password
      })
    })
    .then(response => response.json())
    .then(result => {
      console.log(result);
      if (result.error) {
        document.querySelector('#message').innerHTML = result.error;
      } else {
        document.querySelector('#message').innerHTML = 'Logged in successfully';
      }
    });

    return false;
  };
});
