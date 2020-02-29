---

title: offline
displaytext: Offline
layout: null
order: 2
tab: true
tags: vwad

---

### Offline

<table style="font-size: 16px">
  <tr><th>App. URL</th><th>Author</th><th nowrap="nowrap">Reference(s)</th><th nowrap="nowrap">Technology(ies)</th><th nowrap="nowrap">Note(s)</th></tr>
  {% assign apps = site.data.offline | uniq %}
  {% for app in apps %}
  <tr>
    <td>
        <a href="{{ app.url }}"> {{ app.name }} </a>
        {% if app.badge != nil %}
            <img alt="GitHub stars" src="https://img.shields.io/github/stars/{{ app.badge }}?style=social">
        {% endif %}
    </td>
    <td>
        {{ app.author }}
        {% if app.badge != nil %}
            <img alt="GitHub contributors" src="https://img.shields.io/github/contributors/{{ app.badge }}">
        {% endif %}
    </td>
    <td nowrap="nowrap">
      {% if app.references != empty and app.references != nil %}
        <ul> 
          {% for ref in app.references %}
            <li> <a href="{{ ref.url }}">{{ ref.name }}</a> </li>
          {% endfor %}
        </ul>
      {% endif %}
    </td>
    <td nowrap="nowrap"> 
      {% if app.technology != empty and app.technology != nil %}
        <ul>
          {% for tech in app.technology %}
            <li> {{ tech }} </li>
          {% endfor %}
        </ul>
      {% endif %}
    </td>
    <td>
        {{ app.notes }}
        {% if app.badge != nil %}
            <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/{{ app.badge }}">
        {% endif %}
    </td>
  </tr>
  {% endfor %}
</table>
