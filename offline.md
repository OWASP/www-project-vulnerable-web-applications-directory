---

layout: col-sidebar
title: VWAD - Offline List
tags: vwad
level: 3
type: documentation

---

<link href="assets/vwad.css" rel="stylesheet" type="text/css">

### Offline

Click the triangle to the left of each entry to expand its details.
<p>
<button id="expand" onclick="openAll()">Expand All +</button>

{% assign apps = site.data.offline | uniq %}
{% for app in apps %}
<details>
  <summary> {{ app.name }} </summary>
  <div class="app-entry">
    <a href="{{ app.url }}"> {{ app.name }} </a> <br>
    {% if app.author != "" and app.author != nil %}
      Author: {{ app.author }} <br>
    {% endif %}
    {% if app.notes != "" and app.notes != nil %}
      Notes: {{ app.notes }} <br>
    {% endif %}
    {% if app.references != empty and app.references != nil %} 
      Reference(s): <br>
      <div class="app-sub-list">
        {% for ref in app.references %}
          * <a href="{{ ref.url }}">{{ ref.name }}</a> <br>
        {% endfor %}
      </div>
    {% endif %}
    {% if app.technology != empty and app.technology != nil %}
      Technology(ies): <br>
      <div class="app-sub-list">
        {% for tech in app.technology %}
          * {{ tech }} <br>
        {% endfor %}
      </div>
    {% endif %}
  </div>
</details>
{% endfor %}

<script type='text/javascript'>
  // Fetch all the details element.
  var details = document.querySelectorAll("details");
  
  // Add the onclick listeners.
  details.forEach((targetDetail) => {
    targetDetail.addEventListener("click", () => {
      // Close all the details that are not targetDetail.
      details.forEach((detail) => {
        if (detail !== targetDetail) {
          detail.removeAttribute("open");
        }
      });
    });
  });
  
</script>
<script>
  var elems = document.getElementsByTagName("details");

function openAll() {
  for (var i = 0; i <= elems.length; i++){
    elems[i].setAttribute("open", "true");
  }
  document.getElementById("expand").setAttribute( "onClick", "javascript: closeAll();" );
  document.getElementById("expand").innerHTML = "Collapse All -";
}

function closeAll() {
  for (var i = 0; i <= elems.length; i++){
    elems[i].removeAttribute("open");
  }
  document.getElementById("expand").setAttribute( "onClick", "javascript: openAll();" );
  document.getElementById("expand").innerHTML = "Expand All +";
}
</script>
