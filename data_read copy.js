function get_data(){
	var urls = {
		campaign_contributions_received: "https://data.hawaii.gov/resource/jexd-xbcg.json",
		campaign_contributions_made_to: "https://data.hawaii.gov/resource/6huc-dcuw.json",
		fundraiser: "https://data.hawaii.gov/resource/2g8e-tamb.json"
	}
	
	var url = "https://data.hawaii.gov/resource/5nbk-8nwt.json?$limit=5&$where=office=%27house%27%20and%20district=%2719%27"
	$.get(url, function(data){
		var contribution_data = data.map(function(d){
									return 	{
										contributor_type: d.contributor_type,
										candidate_name: d.candidate_name,
										date : d.date,
										party : d.party,
										amount: d.amount,
										district: d.district,
										office: d.office,
										occupation: d.occupation,
										contributor_name: d.contributor_name
								
									}
								})														
		console.log(contribution_data);
		modify_data(data);	
	
	})
	
}

function load_candidates(office_name, data){
	var div =  d3.select("body").append("div")
	
	div.attr("id", "candidates")
	
	div.selectAll("a.candidates")
		.data(data)
		.enter()
		.append("a")
}

function modify_data(data){
	var office = [];
	for(var i = 0; i < data.length - 1; i++){
		if(data[i].office !== data[i+1].office){
			office.push(data[i].office);
			office.push(data[i+1].office);
		}
	}
	var div = d3.select("body").append("div")
	
	div.attr("id", "office")
	
	div.selectAll("a.office_names")
		.data(office)
		.enter()
		.append("a")
		.attr("href", "javascript:;")
		.text(function(d) {return d + " | "; })
		.on("click", function(d,i){
			load_candidates(d,data);		
 		})
	console.log(office);
}

get_data();