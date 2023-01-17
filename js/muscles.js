$(document).ready(function () {


    var $table = $("tbody#tbodyappend");

    console.log("Now showing all muscless:")
    const api_url = "http://143.42.26.41/muscles";
    console.log(api_url);
    async function getMuscles() {
        const response = await fetch(api_url);
        const data = await response.json();
        //console.log(data.allMuscles);

        const { latinName } = data.allMuscles;

        const musclesData = data.allMuscles;

        musclesData.forEach(function(data, index) {
            console.log(data.id);
            $table.append("<tr><th colspan='2' style='text-align: center;'>" + data.id + " / " + data.latinName + "</th></tr>");


        });
        for(var k in musclesData) {

            //console.log(k, musclesData[k]);

        }

        //console.log(latinName);
        console.log("works");


    }

    getMuscles();

    console.log("-- OLD --");



    // var $queryurl = "http://localhost:5001/muscles";
    // console.log($queryurl);

    // $.getJSON($queryurl, function (json) {
    //     console.log("hei");
    //     console.log(json);
    //     console.log("-----------");
    //     json.foreach(function(data, index) {
    //         console.log(data);
    //     });
    // });


    console.log("test")
});
