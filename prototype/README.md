# House of Young: website prototype

A clickable design prototype of the public site (Home, Events, Talent, Gallery,
Shop, Contact) for desktop and mobile. It's one self-contained HTML file. The
content is sample data and is not connected to the backend yet.

Open `index.html` in a browser, or serve the folder:

```bash
cd prototype && python -m http.server 8080   # then http://localhost:8080
```

Press play on the turntable for sound: browsers only allow audio after a click.

Next step: rebuild it as the real site on top of the backend API
(`/api/v1/events/`, `/talent/`, `/gallery/`, `/products/`, `/enquiries/...`).
