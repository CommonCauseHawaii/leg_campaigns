// Legislative dates
// 2014-01-15 - 2014-05-01
// 2013 1/16 - 5/3
// 2012 1/18-5/3
// 2011 1/19-5/5
// 2010 1/20-4/29
// 2009 
// 2008
// 2007
// 2006

var urls = {
	campaign_contributions_received: "https://data.hawaii.gov/resource/jexd-xbcg.json",
	campaign_contributions_made_to: "https://data.hawaii.gov/resource/6huc-dcuw.json",
	fundraiser: "https://data.hawaii.gov/resource/2g8e-tamb.json"
}

var election_period = "2012-2014";

function addCommas(nStr)
{
	nStr += '';
	x = nStr.split('.');
	x1 = x[0];
	x2 = x.length > 1 ? '.' + x[1] : '';
	var rgx = /(\d+)(\d{3})/;
	while (rgx.test(x1)) {
		x1 = x1.replace(rgx, '$1' + ',' + '$2');
	}
	return x1 + x2;
}

// Ruby = 1.upto(5) { |i| puts i }
// JS = (1).upto(5, function(i){console.log(i);})
Number.prototype.upto = function(t, cb) {
var i = this;
 
if(t < this) return +this;
 
while (i <= t) {
cb(i++);
}
 
return +this;
};

function query_string(table,chamber, district, offset) {
	if (offset ===0)
		return urls[table]+"?$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27";
	else
		return urls[table]+"?$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27" + "%27&$offset="+offset+"%27";
}
function count_query(table, chamber, district) {
	return urls[table] + "?$select=count(*)&$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27";
}

function get_contributions_received(table, chamber, district, callback) {
	var q = queue();
	
	// by default this gets 1000
	$.get(count_query(table, chamber, district), function(data) {
		var count = data[0].count
		q.defer($.get, query_string(table, chamber, district, 0))
		for (i=0; i < count / 1000; i++) {
			q.defer($.get, query_string(table, chamber, district, i * 1000))
		}
		q.awaitAll(function(results) {
			callback(null, results);
		})
	});
}


function set_up_page(query_data,chamber, district, election_period) {
	clear_page();
	d3.select("#record_count").text(chamber + " " + district + " Race: " + election_period)
	//add_year_links(query_data, chamber, district)
	add_view_toggle(query_data, chamber, district)
}
function add_year_links(query_data, chamber, district) {
	d3.selectAll("#controls a").remove();
	d3.select("#controls")
		.selectAll("a")
		.data(["2006-2008","2008-2010","2010-2012","2012-2014"])
		.enter()
		.append("a")
		.text(function(d) {return d+ " | "})
		.attr("href", "javascript:;")
		.on("click", function(d,i) {
			election_period = d;
			draw(query_data, chamber, district);
		})
	
}
function add_view_toggle(query_data, chamber, district) {
	d3.selectAll("#controls p").remove();
	var toggle_p = d3.select("#controls")
		.append("p")
		
	toggle_p.append("a")
		.text(function(d) {return "Timeline" })
		.attr("href", "javascript:;")
		.on("click", function(d,i) {
			show_candidate_timelines(svgs)
		})
	
	toggle_p.append("span").text(" | ")
	
	toggle_p.append("a")
		.text(function(d) {return "Contribution Types"})
		.attr("href", "javascript:;")
		.on("click", function(d,i) {
			show_candidate_contribution_groupings(svgs)
		})	
}


function class_ify(string_with_spaces) {
	return string_with_spaces.split(" ").join("_").toLowerCase();
}


function pack_contribution_group(svgs, contributor_type, offset, r_scale) {
	y_offset = 100
	contribution_pack = d3.layout.pack()
		.size([200,y_offset])
		.value(function(d) { return d.amount })
		.radius(function(d) { return r_scale(d) / 2 })
		
	contributions = svgs.selectAll("." + class_ify(contributor_type))
		.data(function(d) { 
			contributor_type_node_array = contribution_pack
				.nodes({"children" : d.value.filter(function(e) { return e.contributor_type === contributor_type })}) 

			// packed_circle = contributor_type_node_array.filter(function(e) {return e.children }) 
			// d.center_adjustment = packed_circle.length > 0 ? packed_circle[0].r - y_offset : 0
			// inner_circles_only = contributor_type_node_array
			
				.filter(function (e) {return !e.children && e.depth > 0})	
				
			return contributor_type_node_array;
		})
	
 	contributions
		.enter()
		.append("circle")
		.attr("class", "contribution " + class_ify(contributor_type))
		
	contributions
		.transition()
		.duration(2000)
		.attr("r", function(d) { return d.r })
		.attr("cx", function(d) { return d.x + offset})
		.attr("cy", function(d) { return d.y })
		
	type_label = svgs.selectAll("text.type_" + class_ify(contributor_type))
		.data([0])
		
	type_label
		.enter()
		.append("text")
		.attr("class", "contribution_type type_" + class_ify(contributor_type))
		.attr("x", 100+offset)
		.attr("y", y_offset)
		.attr("fill-opacity", 0)
		.attr("fill", "black")
		.attr("font-size", 10)
		.attr("text-anchor", "middle")
		.text(contributor_type)
		
	type_label
		.transition()
		.duration(3000)
		.attr("fill-opacity", 1)
}

function show_candidate_contribution_groupings(svgs) {
	clear_timeline_context(svgs)
	svgs.selectAll("circle.contribution")
		.on("mouseover", update_readout_for_type)
	
	r_scale = bubble_scale;
	
	pack_contribution_group(svgs, "Immediate Family", 100, r_scale)
	pack_contribution_group(svgs, "Individual", 250, r_scale)
	pack_contribution_group(svgs, "Noncandidate Committee", 400, r_scale)
	pack_contribution_group(svgs, "Other Entity", 550, r_scale)
	pack_contribution_group(svgs, "Political Party", 700, r_scale)
	pack_contribution_group(svgs, "Candidate", 850, r_scale)
}
function date_tick_s(date) {
	var curr_date = date.getDate();
	var curr_month = date.getMonth() + 1; //Months are zero based
	var curr_year = date.getFullYear();
	return (curr_month + " / " + curr_year);
}
function db_date_s(date) {
	var curr_date = date.getDate();
	var curr_month = date.getMonth() + 1; //Months are zero based
	var curr_year = date.getFullYear();
	curr_month = curr_month < 10 ? "0"+curr_month : curr_month
	curr_date = curr_date < 10 ? "0"+curr_date : curr_date
	return (curr_year+"-"+curr_month + "-" + curr_date);	
}
function message_date(date) {
	return (xdate+"").slice(4,15)
}
function clear_grouping_context(svgs) { 
	svgs.selectAll("text.contribution_type").transition().duration(1000).attr("fill-opacity", 0) 
}

function clear_timeline_context(svgs) {
	//svgs.on("mouseover","none").on("mouseout", "none")
	svgs.selectAll("text.timeline_dates").transition().duration(1000).attr("fill-opacity", 0)
	svgs.selectAll("line.timeline_ticks").transition().duration(1000).attr("stroke-opacity", 0)
	svgs.selectAll("line.fundraiser_markers").transition().duration(1000).attr("stroke-opacity", 0)
	svgs.selectAll("rect.session_dates").transition().duration(1000).attr("stroke-opacity", 0).attr("fill-opacity", 0)
	svgs.selectAll("text.session_labels").transition().duration(1000).attr("fill-opacity", 0)
	
}

function add_candidate_summaries(svgs) {
	bar_scale = d3.scale.linear().domain([0,200000]).range([0,200])
	svgs.selectAll("text.candidate_name")
		.data(function(d) { return [d.key] })
		.enter()
		.append("text")
		.attr("class", "candidate_name")
		.attr("x", 150)
		.attr("y", 50)
		.attr("text-anchor", "end")
		.text(function(d) {return d })	
		
	svgs.selectAll("text.funds_raised")
		.data(function(d) { return [d3.sum(d.value, function(e) {return e.amount})] })
		.enter()
		.append("text")
		.attr("class", "funds_raised")
		.attr("text-anchor", "end")
		.attr("x", 150)
		.attr("y", 70)
		.text(function(d) {return "$" + addCommas(Math.round(d)) })
	
	fundraising_totals = svgs.selectAll("rect")
		.data(function(d) { return [d3.sum(d.value, function(e) {return e.amount})] })
		.enter()
		.append("rect")
		.attr("x", 150)
		.attr("y", 75)
		.attr("height", 10)
		.attr("width",0)
		.attr("fill", "green")
		.attr("fill-opacity", .5)
		
	fundraising_totals
		.transition()
		.duration(1000)
		.attr("width", function(d) {return bar_scale(d) })
		.attr("x", function(d) {return 150-bar_scale(d) })
}

contributor_type_scale = d3.scale.category10();

function in_domain(scale, date_check) {
	domain = scale.domain()
	if (date_check >= domain[0] && date_check <= domain[1])
		return true
	else 
		return false
}
function get_data_for_date(data, date_string) {
	return data.filter(function(d) {
		return d.date.slice(0,10) === date_string
		})
}

function get_date_marker_label(data, xdate, date_string) {

	total = d3.sum(data, function(d) {return d.amount})
	var conts = data.length
	return "On " + message_date(xdate) + ", the candidate received <strong>" + conts + "</strong>&nbsp;contributions totaling <strong>$" + addCommas(Math.round(total)) +"</strong>"
}

function update_readout_for_type(d,i) {
	var bottom = this.parentNode.getBoundingClientRect().bottom
	d3.select("#readout")
		.style("left",d3.select(this).attr("cx")+"px")
		.style("top", bottom+"px")
	d3.select("#date").html("<strong>" + d.contributor_name + "</strong> contributed <strong>$"+addCommas(Math.round(d.amount)) + "</strong>")
}

function update_readout(d,i) {
	var bottom = this.parentNode.getBoundingClientRect().bottom
	d3.select("#readout")
		.style("left",d3.select(this).attr("cx")+"px")
		.style("top", bottom+"px")
	
	xdate = timeline_scale.invert(d3.select(this).attr("cx"))
	date = d.date === undefined ? "no date" : d.date.slice(0,10)
	data = d3.select(this.parentNode).datum().value
	date_data = get_data_for_date(data, date)
	
	d3.select("#date").html(get_date_marker_label(date_data, xdate, date))
	
	var contribution_rows = d3.select("#contributions")
		.append("table")
		.selectAll("tr").data(date_data)
		.enter()
		.append("tr")
		.selectAll("td").data(function(d) { return ["$" + addCommas(Math.round(d.amount)), d.contributor_name, d.city] })
		.enter()
		.append("td")
		.text(function(d) { return d})
	
	var sel_contribution = d3.select(this).attr("stroke", "black").attr("stroke_width", "2")
}

function clear_readout(d,i){
	d3.select("#contributions").html("&nbsp;")
	d3.select("#date").html("&nbsp;")
	d3.select("#readout").style("left", "-1000px")
	d3.select(this).attr("stroke", "none")
}



function show_candidate_timelines(svgs) {
	clear_grouping_context(svgs);
	add_candidate_summaries(svgs);
	
	min_date = new Date (election_period.split("-")[0],10,1)
	max_date = new Date (election_period.split("-")[1],10,31)

	bubble_scale = d3.scale.sqrt().domain([0,1000]).range([0,25])
	timeline_scale = d3.time.scale().domain([min_date, max_date]).range([200,1100])
	
	session_data = []
	start_year = timeline_scale.domain()[0].getFullYear() + 1
	end_year = timeline_scale.domain()[1].getFullYear()
	start_year.upto(end_year, function(d) { session_data.push({year:d, start_date: new Date(d,0,11), end_date: new Date(d,4,1)}) })
		
	contributions = svgs.selectAll("circle.contribution")
		.data(function(d) { 
			return d.value.sort(function(a,b) {
				return d3.descending(parseFloat(a.amount), parseFloat(b.amount))
			}) 
		})

	contributions
		.enter()
		.append("circle")
		.attr("class", function(d) { return "contribution " + class_ify(d.contributor_type) })
		.attr("cx", function(d) { return timeline_scale(new Date(d.date))})
		.attr("cy", 50)
		.attr("fill-opacity",0.3)
		.attr("fill", function(d) { return contributor_type_scale(d.contributor_type);})
		.attr("r",0)

	contributions
		.transition()
		.duration(1500)
		.delay(function(d) { return timeline_scale(new Date(d.date)) })
		.attr("cx", function(d) { return timeline_scale(new Date(d.date))})
		.attr("cy", 50)
		.attr("r", function(d) { return bubble_scale(d.amount)})

	contributions
		.on("mouseover", update_readout)
		.on("mouseout", clear_readout)
			
	fundraisers = svgs.selectAll("line.fundraiser_markers")
		.data(function(d) { return d.fundraisers })

	fundraisers
		.enter()
		.append("line")
		.attr("class", "fundraiser_markers")
		.attr("y1",85).attr("y2",85)
		.attr("x1", function(d) {return timeline_scale(new Date(d.fundraiser_date_2))})
		.attr("x2", function(d) {return timeline_scale(new Date(d.fundraiser_date_2))})
		.attr("stroke", "white")
		.attr("stroke-width", 1)
		.on("mouseover", function(d,i) {
			d3.select("#contributions").text(d.fundraiser_date + " / " + d.place_of_fundraiser + " / " + d.price_or_suggested_contribution_max_range)
		})
		.on("mouseout", function(d,i){
			d3.select("#contributions").html("&nbsp;")
		})

	fundraisers
		.transition()
		.delay(function(d) { return timeline_scale(new Date(d.fundraiser_date_2)) })
		.duration(1000)
		.attr("stroke", "red")
		.attr("stroke-opacity", 1)
		.attr("y1",70).attr("y2",50)
			
	tick_data = timeline_scale.ticks(10)
	timeline_ticks = svgs.selectAll("line.timeline_ticks")
		.data(tick_data)

	timeline_ticks
		.enter()
		.append("line")
		.attr("class", "timeline_ticks")
		.attr("x1", function(d) { return timeline_scale(d) })
		.attr("x2", function(d) { return timeline_scale(d) })
		.attr("y1", 85)
		.attr("y2", 90)
		.attr("stroke", "gray")
		.attr("stroke-opacity", 0)

	timeline_ticks
		.transition()
		.delay(function(d) { return timeline_scale(d) })
		.duration(1000)
		.attr("stroke-opacity", 1)
		.attr("stroke", "gray")
	
	timeline_dates = svgs.selectAll("text.timeline_dates")
		.data(tick_data)
	
	timeline_dates
		.enter()
		.append("text")
		.attr("class", "timeline_dates")
		.attr("font-size", 10)
		.attr("text-anchor", "middle")
		.attr("fill", "black")
		.attr("fill-opacity", 0)
		.attr("x", function(d) {return timeline_scale(d)})
		.attr("y", 105)
		.text(function(d) { return date_tick_s(d) })
		
	timeline_dates
		.transition()
		.delay(function(d) { return timeline_scale(d) })
		.duration(1000)
		.attr("fill-opacity", 1)
		
	var session_y = 70;
	session_dates = svgs.selectAll("rect.session_dates")
		.data(session_data)
		
	session_dates
		.enter()
		.append("rect")
		.attr("class", "session_dates")
		.attr("x", function(d) {return timeline_scale(d.start_date)})
		.attr("y", session_y)
		.attr("height", 15)
		.attr("width", 0)
		.attr("stroke","#EEE")
		.attr("stroke-width", 1)
		.attr("stroke-opacity", 1)
		.attr("fill", "#EEE")
		.attr("fill-opacity", .2)
		
	session_dates
		.transition()
		.duration(1000)
		.delay(function(d) {return timeline_scale(d.start_date)})
		.attr("stroke-opacity", 1)
		.attr("width", function(d) {return timeline_scale(d.end_date) - timeline_scale(d.start_date)})
		
	session_labels = svgs.selectAll("text.session_labels")
		.data(session_data)
	
	session_labels
		.enter()
		.append("text")
		.attr("class","session_labels")
		.attr("x", center_session)
		.attr("y", session_y+11)
		.attr("text-anchor", "middle")
		.attr("font-size", 10)
		.attr("fill", "black")
		.attr("fill-opacity", 0)
		.text(function(d) { return d.year+" Session" })
	
	session_labels
		.transition()
		.duration(1000)
		.delay(function(d) {return timeline_scale(d.start_date)})
		.attr("fill-opacity", 1)

}

function center_session(d) {
	startx = timeline_scale(d.start_date)
	endx = timeline_scale(d.end_date)
	return startx+(endx - startx)/2
}


function data_by_candidate(query_data, election_period, chamber, district) {
	candidates = d3.entries(d3.nest().key(function(d) {return d.candidate_name}).map(query_data[0].filter(function(d) {return d.election_period === election_period })))
	fundraisers_for_candidates = d3.nest().key(function(d) {return d.candidate_name}).map(
		//query_data[1].filter(function(d) { return d.election_period === election_period })
		fundraiser_data.filter(function(d) {
			return d.election_period === election_period && d.office === chamber && d.district === district+""
		})
	)
	candidates.forEach(function(d) { d.fundraisers = fundraisers_for_candidates[d.key] !== undefined ? fundraisers_for_candidates[d.key] : [] })
	return candidates	
}
function create_candidate_svgs(candidates) {
	
	var svgs = d3.select("#svgs")
		.selectAll("svg")
		.data(candidates)
		.enter()
		.append("svg")
		.attr("class", function(d){return d.key})
		.attr("width",1400)
		.attr("height",120)
	return svgs;
}

function create_race_context_svg(chamber, district) {
	race_context = d3.select("#race_context")
		.selectAll("svg")
		.data(summary_data.filter(function(d) { return d.key === chamber+" "+zero_pad(district+"") }))
		
	race_summary(race_context)
	
}

function clear_page() {
	d3.selectAll(".small").remove()
	d3.select("#svgs").html("")
	d3.select("#race_context").html("")
}

function draw(query_data, chamber, district) {
	
	set_up_page(query_data, chamber, district, election_period)
	candidate_data = data_by_candidate(query_data, election_period, chamber, district)
	svgs = create_candidate_svgs(candidate_data)
	create_race_context_svg(chamber, district)
	show_candidate_timelines(svgs, election_period)
	//populate_table("fundraiser", query_data[1], null, election_period, [])
	//populate_table("campaign_contributions_received", query_data[0], "amount", election_period, query_data[1])
	
}
function populate_table(table_name, data, sum_field, election_period, optional_data) {
	d3.selectAll("."+table_name).remove()

	d3.select("body").append("h2").attr("class",table_name).text(table_name+": "+data.length+" records");
	if (data.length === 0) return;
	
	table = d3.select("body").append("table").attr("class", table_name+ " small");
	
	table.append("tr")
		.data([data[0]])
		.selectAll("th")
		.data(function(d) {return d3.keys(d)})
		.enter()
		.append("th")
		.text(function(d) {return d;})
		
	contribution_rows = table
		.selectAll("tr.data")
		.data(data)
		.enter()
		.append("tr")
		.attr("class", "data")
	
	contribution_rows
		.selectAll("td")
		.data(function(d) {return d3.values(d)})
		.enter()
		.append("td")
		.text(function(d) {return d });
}

function get_data(chamber, district){

	var q1=queue()
	q1.defer(get_contributions_received,"campaign_contributions_received", chamber, district);
	//q1.defer(get_contributions_received,"fundraiser", chamber, district);
	q1.awaitAll(function(error, results) {
		draw(results, chamber, district);
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

function load_districts(house_districts, senate_districts){

	var div = d3.select("#districts")
	div.append("span").text("House District:")
	d3.select("div")
		.selectAll("a.house_race")
		.data(house_districts)
		.enter()
		.append("a")
		.attr("class", "house_race")
		.text(function(d){ return d +" | "; })
		.attr("href", "javascript:;")
		.on("click", function(d,i) { 
			get_data("House", d);
		;})

	d3.select("div").append("br")
	d3.select("div").append("span").text("Senate District:")
	d3.select("div")
		.selectAll("a.senate_race")
		.data(senate_districts)
		.enter()
		.append("a")
		.attr("class", "senate_race")
		.text(function(d){ return d +" | "; })
		.attr("href", "javascript:;")
		.on("click", function(d,i) { 
			get_data("Senate", d);
		;})
		
	
}

function load_dataset(){	
	// var house_districts =[];
	// for(var i = 1; i < 52; i++){house_districts.push(i)}
	// 
	// var senate_districts = [];
	// for(var i = 1; i < 26; i++){senate_districts.push(i)}
	// 
	// load_districts(house_districts, senate_districts);
	get_data("House", 1);

}


var summary_data
var winner_data
var race_scale = d3.scale.ordinal().domain(["2006-2008", "2008-2010", "2010-2012", "2012-2014"]).range([200,350,500,650])


function race_summary(sum_svgs) {
	sum_svgs
		.enter()
		.append("svg")
		.attr("class", "district_summary")
		.attr("height", 100)
		.attr("width", 900)

	sum_svgs
		.selectAll("text.district_label")
		.data(function(d) { return [d.key] })
		.enter()
		.append("text")
		.attr("class", "district_label")
		.attr("x", 10)
		.attr("y", 20)
		.text(function(d) {return d})
		
	var race_details = sum_svgs
		.selectAll("g.race_detail")
		.data(function(d) { return d.values })
	
	race_details
		.enter()
		.append("g")
		.attr("class", "race_details")
		.attr("cursor", "pointer")
		.attr("transform", function(d) { return "translate("+ race_scale(d.key) +",20)" })
		.on("mouseover", function(d) {
			d3.select(this).select("rect.highlight_box").attr("stroke-opacity", 1)
		})
		.on("mouseout", function(d) {
			d3.select(this).select("rect.highlight_box").attr("stroke-opacity", 0)
		})
		.on("click", function(d) {
			election_period = d.key
			get_data(d.values[0].office, d.values[0].district)
		})
		
	race_details
		.append("rect")
		.attr("class", "highlight_box")
		.attr("fill", "white")
		.attr("stroke", "red")
		.attr("x", -5)
		.attr("y", -10)
		.attr("width", 150)
		.attr("height", 89)
		.attr("stroke-opacity", 0)

	race_details
		.append("text")
		.attr("class", "election_period_label")
		.attr("x", 0)
		.attr("y", 0)
		.attr("fill", "#017d75")
		.attr("font-size", 10)
		.text(function(d) {return d.key})
	
	var bar_offset = 15
	var candidate_labels = race_details
		.selectAll("text.candidate_labels")
		.data(function(d) { return d.values })
		.enter()
		.append("text")
		.attr("class", "candidate_labels")
		.attr("x", 0)
		.attr("y", function(d,i) { return i * 14 + bar_offset})
		.attr("font-size", 10)
		.attr("fill", function(d) { return d.winner ? "black" : "#AAA"})
		.text(function(d) { return d.candidate_name })

	var candidate_totals = race_details
		.selectAll("rect.candidate_totals")
		.data(function(d) { return d.values })
		.enter()
		.append("rect")
		.attr("class", "candidate_totals")
		.attr("x", 0)
		.attr("y", function(d,i) { return i * 14 + bar_offset - 9})
		.attr("width", function(d) { return fund_scale(d.sum_amount) } )
		.attr("height", 10)
		.attr("fill", "#e94a47")
		.attr("fill-opacity", .5)

	
}

function zero_pad(num_string) {
	return num_string.length === 1 ? "0"+num_string : num_string
}

//assuming winner_data is ready
function draw_summary(data) {
		
	fund_scale = d3.scale.linear().domain([0,300000]).range([0,140])
	summary_data = d3.nest()
		.key(function(d) { return d.office+" "+zero_pad(d.district)})
		.sortKeys(d3.ascending)
		.key(function(d) {return d.election_period})
		.entries(data)
	
	//insert_winner_info
	summary_data.forEach(function(district) {
		district.values.forEach(function(period) {
			winner_key = district.key+" "+period.key.slice(5,10)
			winner = period.values.filter(function(d) {
				if (!winner_data[winner_key]) return false 
				return d.candidate_name.split(",")[0].toUpperCase() === winner_data[winner_key]["didate Name"]
			})[0]
			if (winner) {
				winner["winner"] = true;
				//console.log(winner_key + " : " + winner.candidate_name)
			} else {
				//console.log(winner_key + " no winner")
			}
			
		})
	})
	var sum_svgs = d3.select("#summary_svgs") // here is where you can change the containing div
		.selectAll("svg.district_summary")
		.data(summary_data)

	race_summary(sum_svgs)
		
	
}



function load_summary_data() {
	query = "https://data.hawaii.gov/resource/jexd-xbcg.json?$select=candidate_name,%20election_period,%20office,%20district,%20count%28*%29,%20sum%28amount%29%20&$where=office=%27House%27 OR office='Senate'&$group=office,%20district,%20election_period,%20candidate_name"
	$.get(query, draw_summary);
}
function load_winner_data() {
	d3.csv("election_results.csv", function(data) {
		winner_data = d3.nest()
			.key(function(d) { return d.Title+" "+zero_pad(d.District)+" "+d.Election})
			.sortKeys(d3.ascending)
			.rollup(function(leaves) { return leaves.sort(function(a,b) { return d3.descending(parseInt(a["Total Votes"]), parseInt(b["Total Votes"])) })[0] })
			.map(data);
		
			load_summary_data();

	})
}

var fundraiser_data

$.get(urls["fundraiser"], function(results) {
	fundraiser_data = results
	load_dataset();
})

load_winner_data();
