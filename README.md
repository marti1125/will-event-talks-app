# BigQuery Release Notes Dashboard & Tweet Sharer

A beautiful, premium web application built using Python Flask, vanilla CSS (with modern dark-mode aesthetics), and vanilla JavaScript. It parses Google's BigQuery Atom feed to extract individual updates, offers instant filters and search capabilities, and includes an interactive Tweet composer with character counting, circular progress indicators, and custom hashtag tools to share updates on X (Twitter).

---

## Features

- **Automated RSS Fetching & Proxy Caching**: Fetches the live BigQuery Release Notes feed directly and handles parsing on the fly. Utilizes an in-memory caching mechanism (5-minute TTL) to keep load times short and minimize requests to Google, with a manual **Force Refresh** bypass button.
- **Granular Update Separation**: Instead of displaying release notes as block pages by date, the frontend's custom HTML parser processes the DOM to split a single day's logs into discrete cards, categorizing them automatically (e.g. *Features*, *Announcements*, *Issues*, *Deprecated*, *Changed*).
- **Responsive Dark Theme with Glassmorphism**: High-end styling inspired by modern dev tool dashboards, featuring:
  - Vivid ambient background blobs with slow rotation animations.
  - Transparent card structures, backdrop blurs, and glow border hover effects.
  - Visual category coding (e.g., emerald badges for features, yellow-amber for announcements, rose-red for issues, and purple for deprecations).
- **Instant Filtering & Search**: Clean search bar and filter chips that filter updates in real-time with smooth entry transitions.
- **Tweet Composer & Share Intent**: 
  - A popup dialog with a prefilled tweet containing the update summary, release date, relevant GCP hashtags, and link.
  - A character countdown out of 280 with a circular SVG progress ring changing colors from blue, to orange (warning), to red (exceeded).
  - Quick-add hashtag pills (`#BigQuery`, `#GoogleCloud`, `#GCP`, `#DataAnalytics`, `#SQL`) that automatically append to the editor without cursor resets.
  - Opens standard **Twitter/X Web Intent** window for secure login and publishing directly from the user's Twitter account.

---

## Technology Stack

1. **Backend**: Python Flask (handling server routing, XML fetching via `urllib` & `ssl` cert bypass, and parsing using standard library `xml.etree.ElementTree`).
2. **Frontend**: Plain HTML5, CSS3 Custom Properties (Variables) with modern typography (`Inter` & `Outfit`), and Vanilla JavaScript DOM manipulation.

---

## File Structure

```
bq-releases-notes/
├── app.py                  # Flask backend server & Cache Manager
├── templates/
│   └── index.html          # HTML Layout, Skeleton, and Modal Structure
├── static/
│   ├── css/
│   │   └── style.css       # Core styling, variables, blobs, animations
│   └── js/
│       └── app.js          # Feed Client, DOM XML splitter, and Tweet Composer
└── README.md               # Setup Guide
```

---

## Installation & Getting Started

### 1. Requirements

Ensure you have Python 3.13 installed. The Flask library has already been installed on your system.

### 2. Running the Server

Open your terminal or PowerShell window in the project directory (`C:\Users\pc\Documents\agy-cli-projects\bq-releases-notes`) and run the application using the python executable:

```powershell
& "C:\Users\pc\AppData\Local\Programs\Python\Python313\python.exe" app.py
```

### 3. Open the Application

Once the server is running, you will see output indicating that Flask is serving the application:
```text
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

Open your web browser and go to:
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**
