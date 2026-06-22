function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}

// Some vessel/nerve records in the source data are placeholders whose Latin
// name is literally "UNDEFINED". Treat those (and blanks) as "no value".
function isMissing(v) {
    if (v === null || v === undefined) return true;
    var s = String(v).trim();
    return s === '' || s.toUpperCase() === 'UNDEFINED';
}

// Build a cell of links for arteries/veins/nerves, skipping placeholders.
function vesselCell(items, page) {
    var valid = (items || []).filter(function (it) { return !isMissing(it.latinName); });
    if (valid.length === 0) return "<span class='m-none'>\u2014</span>";
    return valid.map(function (it) {
        return "<a href='" + page + ".html?id=" + it.id + "'>" + it.latinName + "</a>";
    }).join("<br>");
}

function vesselLabel(items, singular, plural) {
    var n = (items || []).filter(function (it) { return !isMissing(it.latinName); }).length;
    return n > 1 ? plural : singular;
}

// Light grey "image not available" placeholder, inlined so no extra request.
var IMG_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTAiIGhlaWdodD0iMTgwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjJmMmYyIiBzdHJva2U9IiNjY2NjY2MiLz48dGV4dCB4PSIxMjUiIHk9Ijk1IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+aW1hZ2Ugbm90IGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';

$(document).ready(function () {

    var $queryurl = "api/muscles/" + getQueryVariable('id');

    $.getJSON($queryurl, function (json) {
        var $table = $("tbody#tbodyappend");

        $table.append("<tr class='m-latin'><th colspan='2'>" + json.latinName + "</th></tr>");
        $table.append("<tr class='m-english'><th colspan='2'>" + json.name + "</th></tr>");

        $table.append("<tr class='m-groups'><td id='muscleGroupCell' colspan='2'></td></tr>");
        $.each(json.muscleGroups, function (key, value) {
            $("#muscleGroupCell").append(value.name + "<br>");
        });

        $table.append("<tr><th>Origo:</th><td>" + json.origo + "</td></tr>");
        $table.append("<tr><th>Insertio:</th><td>" + json.insertio + "</td></tr>");
        $table.append("<tr><th>Functio:</th><td>" + json.functio + "</td></tr>");

        $table.append("<tr class='m-vessel m-artery'><th>" +
            vesselLabel(json.muscleArteries, "Artery:", "Arteries:") +
            "</th><td>" + vesselCell(json.muscleArteries, "artery") + "</td></tr>");

        $table.append("<tr class='m-vessel m-vein'><th>" +
            vesselLabel(json.muscleVeins, "Vein:", "Veins:") +
            "</th><td>" + vesselCell(json.muscleVeins, "vein") + "</td></tr>");

        $table.append("<tr class='m-vessel m-nerve'><th>" +
            vesselLabel(json.muscleNerves, "Nerve:", "Nerves:") +
            "</th><td>" + vesselCell(json.muscleNerves, "nerve") + "</td></tr>");

        if (json.image && String(json.image).trim() !== '') {
            $table.append("<tr class='m-image'><td colspan='2'><img alt='" + json.name +
                "' src='images/muscles/" + json.image +
                "' onerror=\"this.onerror=null;this.src='" + IMG_PLACEHOLDER +
                "';this.classList.add('m-img-missing');\"></td></tr>");
        }

        if (json.comment != 'N/A') {
            $table.append("<tr><th>Comment:</th><td>" + json.comment + "</td></tr>");
        }
    });

});
