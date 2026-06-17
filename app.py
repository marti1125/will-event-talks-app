import time
import urllib.request
import ssl
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache configuration
feed_cache = {
    "data": None,
    "timestamp": 0
}
CACHE_DURATION = 300 # 5 minutes in-memory cache

def fetch_and_parse_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    
    # Create unverified SSL context to bypass local issuer certificate issues on Windows
    context = ssl._create_unverified_context()
    
    # Set headers to look like a standard browser request
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    
    with urllib.request.urlopen(req, context=context) as response:
        xml_data = response.read()
    
    root = ET.fromstring(xml_data)
    ns = {'ns': 'http://www.w3.org/2005/Atom'}
    entries = []
    
    for entry in root.findall('ns:entry', ns):
        title_el = entry.find('ns:title', ns)
        title_text = title_el.text if title_el is not None else ""
        
        id_el = entry.find('ns:id', ns)
        id_text = id_el.text if id_el is not None else ""
        
        updated_el = entry.find('ns:updated', ns)
        updated_text = updated_el.text if updated_el is not None else ""
        
        content_el = entry.find('ns:content', ns)
        content_text = content_el.text if content_el is not None else ""
        
        link_el = entry.find('ns:link', ns)
        link_href = link_el.attrib.get('href', '') if link_el is not None else ""
        
        entries.append({
            "id": id_text,
            "title": title_text,
            "updated": updated_text,
            "content": content_text,
            "link": link_href
        })
        
    return entries

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/notes")
def get_notes():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    current_time = time.time()
    
    # Return cache if valid and not forced
    if not force_refresh and feed_cache["data"] and (current_time - feed_cache["timestamp"] < CACHE_DURATION):
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_fetched": feed_cache["timestamp"],
            "notes": feed_cache["data"]
        })
        
    try:
        data = fetch_and_parse_feed()
        feed_cache["data"] = data
        feed_cache["timestamp"] = current_time
        return jsonify({
            "status": "success",
            "source": "fresh",
            "last_fetched": current_time,
            "notes": data
        })
    except Exception as e:
        # Fallback to cache if request fails
        if feed_cache["data"]:
            return jsonify({
                "status": "partial_success",
                "source": "cache_fallback",
                "error": str(e),
                "last_fetched": feed_cache["timestamp"],
                "notes": feed_cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch release notes: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
