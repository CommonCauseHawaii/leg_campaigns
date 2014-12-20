// Ben Trevino 
// April 2014
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

//http://edu2opendata.xdoe-soh.opendata.arcgis.com/datasets/d71c27f6d2504b3f8eea5314b415ef68_0.geojson

var summary_data
var winner_data
//var precinct_data
var hawaii_geo_json
var race_scale = d3.scale.ordinal().domain(["2006-2008", "2008-2010", "2010-2012", "2012-2014"]).range([200,375,550,725])
var race_highlight_fill = "#f9f9f9"
var race_date_color = "#017d75"
var candidate_name_color = "#AAA"
var winner_name_color = "black"
var candidate_name_color_modal = "#AAA"
var winner_name_color_modal = "black"
var map_fill = "#CCC"
var highlight_fill = "#017d75"
var district_label_color = "#AAA"
var contributor_type_scale = d3.scale.category10();
var contributor_type_scale = d3.scale.ordinal()
		.domain(["Candidate", "Immediate Family", "Individual", "Noncandidate Committee", "Other Entity", "Political Party" ])
		.range(["#e8a624", "#e24481", "#017d75", "#830475", "#5f9c11", "#003e63"])

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

function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
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
	if (offset ===0) {
		console.log(urls[table]+"?$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27%20and%20election_period=%27"+election_period+"%27");
		return urls[table]+"?$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27%20and%20election_period=%27"+election_period+"%27";
	}
	else {
		console.log(urls[table]+"?$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27%20and%20election_period=%27"+election_period+"%27&$offset="+offset+"%27");
		return urls[table]+"?$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27%20and%20election_period=%27"+election_period+"%27&$offset="+offset+"%27";
	}
}
function count_query(table, chamber, district) {
	return urls[table] + "?$select=count(*)&$where=office=%27"+chamber+"%27%20and%20district=%27"+district+"%27%20and%20election_period=%27"+election_period+"%27";
}

function get_contributions_received(table, chamber, district, callback) {
	var q = queue();
	
	// by default this gets 1000
	$.get(count_query(table, chamber, district), function(data) {
		var count = data[0].count
		console.log(count)
		for (i=0; i < count / 1000; i++) {
			q.defer(d3.json, query_string(table, chamber, district, i * 1000))
		}
		q.awaitAll(function(error, results) {
			merged = []
			merged = merged.concat.apply(merged, results);
			callback(null, merged);
		})
	});
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
		.text(function(d) {return "Show Contributor Groupings"})
		.attr("href", "javascript:;")
		.on("click", function(d,i) {
			show_candidate_contribution_groupings(svgs)
		})	
}


function class_ify(string_with_spaces) {
	return string_with_spaces.split(" ").join("_").toLowerCase();
}

function get_pack_sizes(svg, r_scale, contributor_types) {
		
	var contribution_pack = d3.layout.pack()
		.size([200,200])
		.value(function(d) { return d.amount })
		.radius(function(d) { return r_scale(d) / 2 })
		
	pack_sizes = contributor_types.map(function(contributor_type) {
		return candidate_data.map(function(d) { 
			console.log(d.value)
			return contribution_pack
			.nodes({"children" : d.value.filter(function(e) { return e.contributor_type === contributor_type[1] })}) 
			.filter(function (e) {return e.depth === 0})[0].r
		}) 
	})
	
	console.log("Pack Sizes")
	console.log(pack_sizes)
	var col_widths = pack_sizes.map( function(d) { 
		var min_width = d3.max(d) * 2
		if (min_width === 0) return 0
		return min_width < minimum_grouping_width ? minimum_grouping_width : min_width +10 
	} )
	var row_heights = candidate_data.map( function(d,i) { 
		var min_height = d3.max(pack_sizes, function(e) { return e[i] }) * 2
		return min_height < timeline_height ? timeline_height : min_height + 20
	})
	return {col_widths: col_widths, row_heights: row_heights }


}

function pack_contribution_group(svgs, contributor_type, contributor_code, offset, r_scale, row_heights, col_width) {

	contribution_pack = d3.layout.pack()
		//.size([200, 100])
		.value(function(d) { return d.amount })
		.radius(function(d) { return r_scale(d) / 2 })
		
	contributions = svgs.selectAll("." + class_ify(contributor_code))
		.data(function(d, i) { 
			contribution_pack.size([col_width, row_heights[i] ])
			console.log(contribution_pack.size())
			contributor_type_node_array = contribution_pack
				.nodes({"children" : d.value.filter(function(e) { return e.contributor_type === contributor_code })}) 
				.filter(function (e) {return !e.children && e.depth > 0})	
				
			return contributor_type_node_array;
		})
	
 	contributions
		.enter()
		.append("circle")
		.attr("class", "contribution " + class_ify(contributor_code))
		
	contributions
		.transition()
		.duration(2000)
		.attr("r", function(d) { return d.r })
		.attr("cx", function(d) { return d.x + offset})
		.attr("cy", function(d) { return d.y })
		
	type_label = svgs.selectAll("text.type_" + class_ify(contributor_code))
		.data(function(d,i) {return [i]})
		
	type_label
		.enter()
		.append("text")
		.attr("class", "contribution_type type_" + class_ify(contributor_code))
		.attr("x", col_width / 2+offset)
		.attr("y", function(d,i) { return row_heights[d] })
		.attr("fill-opacity", 0)
		.attr("fill", "black")
		.attr("font-size", 10)
		.attr("text-anchor", "middle")
		.text(function(d) {return col_width > 0 ? contributor_type : ""})
		
	type_label
		.transition()
		.duration(3000)
		.attr("fill-opacity", 1)
}

function show_candidate_contribution_groupings(svgs) {

	clear_timeline_context(svgs)
	r_scale = bubble_scale;
	//contributor_types = [["Candidate", "CAN"], ["Immediate Family", "IMM"], ["Individual", "IND"], ["Noncandidate Committee", "NCC"], ["Other Entity","OTH"], ["Political Party","PP"]  ]
	contributor_types = [["Candidate", "Candidate"], ["Immediate Family", "Immediate Family"], ["Individual", "Individual"], ["Noncandidate Committee", "Noncandidate Committee"], ["Other Entity","Other Entity"], ["Political Party","Political Party"]  ]
	

	ps = get_pack_sizes(svgs, r_scale, contributor_types)
	console.log(ps)
	var baseline = 0
	v_offsets = ps.row_heights.map(function(d) {
		var offset = baseline
		baseline = d + baseline;
		return offset;
	})
	baseline = 150
	h_offsets = ps.col_widths.map(function(d) {
		var offset = baseline
		baseline = d + baseline;
		return offset;
	})
	console.log(h_offsets)
	d3.select("#svgs svg")
		.transition()
		.duration(1000)
		.attr("height", d3.sum(ps.row_heights) + 60)
		
	svgs.transition()
		.duration(1000)		
		.attr("y_offset", function(d,i) { return v_offsets[i] })
		.attr("transform", function(d,i) { return "translate(0, " + v_offsets[i] + ")" } )
	
	svgs.selectAll("circle.contribution")
		.on("mouseover", update_readout_for_type)
	
	contributor_types.forEach(function(contributor_type, i) {
		console.log(contributor_type)
		console.log(ps.col_widths[i])
		pack_contribution_group(svgs, contributor_type[0], contributor_type[1], h_offsets[i], r_scale, ps.row_heights, ps.col_widths[i])
	})

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
	svgs.selectAll("text.fundraiser_flag").transition().duration(1000).attr("fill-opacity", 0)
	svgs.selectAll("rect.session_dates").transition().duration(1000).attr("stroke-opacity", 0).attr("fill-opacity", 0)
	svgs.selectAll("text.session_labels").transition().duration(1000).attr("fill-opacity", 0)
	
}

function add_candidate_summaries(svgs) {
	bar_scale = d3.scale.linear().domain([0,200000]).range([0,200])
	svgs.selectAll("text.candidate_name")
		.data(function(d) { return [d] })
		.enter()
		.append("text")
		.attr("class", "candidate_name")
		.attr("x", 150)
		.attr("y", 50)
		.attr("text-anchor", "end")
		.attr("fill", function(d) { return d.winner ? winner_name_color_modal : candidate_name_color_modal})
		.text(function(d) {return d.key })	
		
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
		.attr("fill", "#017d75")
		.attr("fill-opacity", .5)
		
	fundraising_totals
		.transition()
		.duration(1000)
		.attr("width", function(d) {return bar_scale(d) })
		.attr("x", function(d) {return 150-bar_scale(d) })
}


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

function move_readout(d3_this) {
	var circle = d3.select(d3_this)
	var cx = parseFloat(circle.attr("cx")) - 125 //width is set at 250
	var perimeter_y = parseFloat(d3.select(d3_this.parentNode).attr("y_offset")) + parseFloat(circle.attr("cy")) + parseFloat(circle.attr("r")) + 10 
	d3.select("#readout")
		.style("left",cx+"px")
		.style("top", perimeter_y+"px")
}

function update_fundraiser_readout(d,i) {
	var text = d3.select(this)
	var x = parseFloat(text.attr("x")) - 125
	var y = parseFloat(d3.select(this.parentNode).attr("y_offset")) + 95
	d3.select("#readout")
		.style("left",x+"px")
		.style("top", y+"px")

	d3.select("#date").html("Fundraiser at <strong>Mandalay Restaurant</strong> on <strong>" + d.fundraiser_date + "</strong> held in " + d.fundraiser_city + " and organized by " + d.person_in_charge + ". Suggested contribution: <strong>$" + d.price_or_suggested_contribution_max_range + "</strong>")	
}


function update_readout_for_type(d,i) {
	move_readout(this)
	d3.select("#date").html("<strong>" + d.contributor_name + "</strong> contributed <strong>$"+addCommas(Math.round(d.amount)) + "</strong>")
}

function update_readout(d,i) {
	move_readout(this)
	
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
			
	d3.select("#svgs svg")
		.transition()
		.duration(1000)
		.attr("height", candidate_data.length * timeline_height + 60)
		
	svgs
		.transition()
		.duration(1000)
		.attr("y_offset", function(d,i) { return i * timeline_height })
		.attr("transform", function(d,i) { return "translate(0, " + i * timeline_height+ ")" } )
	
	min_date = new Date (election_period.split("-")[0],10,1)
	max_date = new Date (election_period.split("-")[1],10,31)

	bubble_scale = d3.scale.sqrt().domain([0,1000]).range([0,20])
	timeline_scale = d3.time.scale().domain([min_date, max_date]).range([200,900])
	
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
		.attr("stroke", "#AAA")
		.attr("stroke-opacity", 1)
		.attr("y1",70).attr("y2",10)
		
	fundraiser_flags = svgs.selectAll("text.fundraiser_flag")
		.data(function(d) { return d.fundraisers })
	
	fundraiser_flags 
		.enter()
		.append("text")
		.attr("class", "fundraiser_flag")
		.attr("x", function(d) {return timeline_scale(new Date(d.fundraiser_date_2)) + 3})
		.attr("y", 20)
		.attr("fill", "#AAA")
		.attr("fill-opacity", 0)
		.attr("cursor", "pointer")
		.text("F")
		.on("mouseover", update_fundraiser_readout)
		.on("mouseout", clear_readout)
				
	fundraiser_flags
		.transition()
		.delay(function(d) { return timeline_scale(new Date(d.fundraiser_date_2)) })
		.duration(1000)
		.attr("fill-opacity", 1)
			
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
		fundraiser_data.filter(function(d) {
			return d.election_period === election_period && d.office === chamber && d.district === district+""
		})
	)
	candidates.forEach(function(d) { 
		d.fundraisers = fundraisers_for_candidates[d.key] !== undefined ? fundraisers_for_candidates[d.key] : [] 
		winner_key = chamber+" "+zero_pad(district+"")+" "+election_period.slice(5,10)
		if (winner_data[winner_key] && winner_data[winner_key]["didate Name"] === d.key.split(",")[0].toUpperCase())
			d.winner = true
	})

	return candidates	
}
timeline_width = 1000
timeline_height = 120
minimum_grouping_width = 150
function create_candidate_svgs(candidates) {
	
	var svgs = d3.select("#svgs")
		.append("svg")
		.attr("width",timeline_width)
		.attr("height",timeline_height * candidates.length)
		.selectAll("g.timeline")
		.data(candidates)
		.enter()
		.append("g")
		.attr("class", function(d){return "timeline "+d.key})
		.attr("transform", function(d,i ) { return "translate(0," + i * timeline_height + ")"})
		
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

function set_up_page(chamber, district) {
	clear_page();
	d3.select("#record_count").text(chamber + " " + district + " Race: " + election_period)
	create_race_context_svg(chamber, district)
}

function draw(query_data, chamber, district) {
	
	candidate_data = data_by_candidate(query_data, election_period, chamber, district)
	add_view_toggle(query_data, chamber, district)
	svgs = create_candidate_svgs(candidate_data)
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
	q1.awaitAll(function(error, results) {
		draw(results, chamber, district);
	})
	set_up_page(chamber, district)
}

function load_candidates(office_name, data){
	var div =  d3.select("body").append("div")
	
	div.attr("id", "candidates")
	
	div.selectAll("a.candidates")
		.data(data)
		.enter()
		.append("a")
}

var inset_svg;
var county_selected = "STATE"

function precinct_class(d) {
	return "H" + d.properties.State_House + " P" + d.id + " S" + d.properties.State_Senate;
}

function check_county(d) { 
	var county = d.properties.COUNTY
	if (map_clicked) return;
	if (county_selected !== county) {
		county_selected = county
		zoom_to_bounds(county_bounds[county])
	}
	
} 
function draw_map(){
	d3.select("#district_map")
		.append("div")
		.attr("id", "reset_container")
		.append("a")
		.attr("id", "reset_button")
		.attr("href", "javascript:;")
		.on("click", reset)
		.text("Reset Map")
	
	var precinct_data = topojson.feature(hawaii_geo_json, hawaii_geo_json.objects.updated_precincts).features
	precinct_data = precinct_data.filter(function(d) { return d.id !== "30-04"}) //this one seems to have a screwed up path
	create_inset(precinct_data)
			
}
 
//don't need these county projections anymore
var inset_projections = {
	"OAHU": d3.geo.albers().center([0, 18.5]).rotate([157.967, -2.941]).scale(29284).translate([308, 139]),
	"HAWAII": d3.geo.albers().center([0, 18.5]).rotate([155.527, -.99]).scale(11016).translate([355, 159]),
    "KAUAI": d3.geo.albers().center([0, 18.5]).rotate([159.917, -3.374]).scale(16431).translate([288, 170]),
    "MAUI": d3.geo.albers().center([0, 18.5]).rotate([156.665, -2.290]).scale(18428).translate([305, 159]),
	"STATE": d3.geo.albers().center([0, 18.5]).rotate([159.266, -3.049]).parallels([15, 25]).scale(5000).translate([130, 90])
}
var county_bounds = {}

var map_clicked = false

function reset(d) {
	map_clicked = true; 
	county_selected = "STATE"
	d3.select("#reset_container").style("display", "none")
	inset_svg.selectAll("path").attr("fill", map_fill)//.attr("stroke", map_fill)
	inset_svg.transition()
		.duration(750)
		.call(zoom.translate([0, 0]).scale(1).event)
		.each("end", function(d) { 
			map_clicked = false;
			draw_summary(summary_data.filter(function(d){if(d.key.match(/^H/g)){return true;}}),"#house_summaries");
			draw_summary(summary_data.filter(function(d){if(d.key.match(/^S/g)){return true;}}),"#senate_summaries");	
		});
	
}
function highlight_precinct_from_this(d, obj) {
	if (map_clicked) return;
	
	inset_svg.selectAll("path").attr("fill", map_fill)//.attr("stroke", map_fill)
	d3.select(obj).attr("fill", highlight_fill)//.attr("stroke", highlight_fill)
	draw_summary(summary_data.filter(function(e) { 
		return e.key === "House "+ zero_pad(d.properties.State_House+"") 
	}),"#house_summaries")
	draw_summary(summary_data.filter(function(e) { 
		return e.key === "Senate "+zero_pad(d.properties.State_Senate+"")
	}),"#senate_summaries")	
}
function highlight_precinct(d) {
	check_county(d)
	highlight_precinct_from_this(d, this)
}

function zoom_to_bounds(bounds) {
	d3.select("#reset_container").style("display", "block")
	var map_clicked_state = map_clicked
	map_clicked = true
	var	  dx = bounds[1][0] - bounds[0][0],
	      dy = bounds[1][1] - bounds[0][1],
	      x = (bounds[0][0] + bounds[1][0]) / 2,
	      y = (bounds[0][1] + bounds[1][1]) / 2,
	      scale = .6 / Math.max(dx / inset_width, dy / inset_height),
	      translate = [inset_width / 2 - scale * x, inset_height / 2 - scale * y];
	
	inset_svg.transition()
	      .duration(750)
	      .call(zoom.translate(translate).scale(scale).event)
		.each("end", function(d) { map_clicked = map_clicked_state });;
	
}

var geo_path = d3.geo.path().projection(inset_projections["STATE"])
function inset_click(d) {
	d3.event.stopPropagation()

	if (d3.event.defaultPrevented) { return } 
	
	if (map_clicked) {
		map_clicked = false;
		highlight_precinct_from_this(d,this)
	}

	map_clicked = true
	
	var bounds = geo_path.bounds(d)
	zoom_to_bounds(bounds)
		
	
}

zoom = d3.behavior.zoom()
    .translate([0, 0])
    .scale(1)
    .scaleExtent([1, 40])
    .on("zoom", zoomed);

var inset_width = 550;
var inset_height = 350;

function zoomed() {
	if (d3.event.sourceEvent) { d3.select("#reset_container").style("display", "block")	}
	inset_svg.select("g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

function county_accessor(d) {
	return d.__data__.properties.COUNTY
}

function create_inset(data){
	
	inset_svg = d3.select("#district_map")
		.append("svg")
		.attr("id", "overview_map")
		.attr("width", inset_width)
		.attr("height", inset_height)
		.on("click", reset)
	
	var g = inset_svg.append("g")
	
	paths = g.selectAll("path")
		.data(data)
		.enter()
		.append("path")
		.attr("fill", map_fill)
		.attr("stroke", "white")
		.attr("stroke-width", .05)
		.attr("class", precinct_class)
		.attr("d", d3.geo.path().projection(inset_projections["STATE"]))
		.on("mouseover", highlight_precinct)
		.on("click", inset_click)

	d3.keys(inset_projections).forEach(function(area) { 
		var included_precincts = paths[0].filter(function(d) { return county_accessor(d) === area})
		var precinct_bounds = included_precincts.map(function(d) { return geo_path.bounds(d.__data__)})
		var left = d3.min(precinct_bounds, function(d) {return d[0][0]}),
			top = d3.min(precinct_bounds, function(d) {return d[0][1]}),
			right = d3.max(precinct_bounds, function(d) {return d[1][0]}),
			bottom = d3.max(precinct_bounds, function(d) {return d[1][1]})
			
		county_bounds[area] = [[left, top], [right, bottom]]
	})
	
	inset_svg
		.call(zoom)
		.call(zoom.event);
		
			
}




function race_summary(sum_svgs) {
	sum_svgs
		.enter()
		.append("svg")
		.attr("class", "district_summary")
		.attr("height", 120)
		.attr("width", 900)
	
	sum_svgs
		.selectAll("image")
		.data(function(d) { return [d.key] })
		.enter()
		.append("image")
		.attr("x", 10)
		.attr("y", 10)
		.attr("height", 100)
		.attr("width", 100)
		.attr("xlink:href", function(d) { return "assets/img/map"+d.split(" ")[0][0]+d.split(" ")[1]+".png" })
	
	sum_svgs
		.selectAll("text.district_label")
		.data(function(d) { return [d.key] })
		.enter()
		.append("text")
		.attr("class", "district_label")
		.attr("x", 80)
		.attr("y", 30)
		.attr("fill", district_label_color)
		.text(function(d) {
			var c=d.split(" "); 
			return c[1]
		})
        .attr("font-size", 34)
                
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
			d3.select(this).select("rect.highlight_box").attr("fill", race_highlight_fill)
		})
		.on("mouseout", function(d) {
			d3.select(this).select("rect.highlight_box").attr("fill", "white")
		})
		.on("click", function(d) {
			election_period = d.key
			get_data(d.values[0].office, d.values[0].district)
            $("#S200620081").modal("show");
         
         })
		
	race_details
		.append("rect")
		.attr("class", "highlight_box")
		.attr("fill", "white")
		//.attr("stroke", "red")
		.attr("x", -50)
		.attr("y", -15)
		.attr("width", 175)
		.attr("height", 110)
		.attr("stroke-opacity", 0)

	race_details
		.append("text")
		.attr("class", "election_period_label")
		.attr("x", 0)
		.attr("y", 10)
		.attr("fill", race_date_color)
		.attr("font-size", 14)
		.text(function(d) {return d.key})
	
	var bar_offset = 30
	var candidate_height = 15
	var x_offset = 75
	var candidate_labels = race_details
		.selectAll("text.candidate_labels")
		.data(function(d) { return d.values })
		.enter()
		.append("text")
		.attr("class", "candidate_labels")
		.attr("text-anchor", "end")
		.attr("x", x_offset - 5)
		.attr("y", function(d,i) { return i * candidate_height + bar_offset})
		.attr("font-size", 13	)
		.attr("fill", function(d) { return d.winner ? winner_name_color : candidate_name_color})
		.text(function(d) { return d.candidate_name })

	var candidate_totals = race_details
		.selectAll("rect.candidate_totals")
		.data(function(d) { return d.values })
		
	candidate_totals
		.enter()
		.append("rect")
		.attr("class", "candidate_totals")
		.attr("x", x_offset)
		.attr("y", function(d,i) { return i * candidate_height + bar_offset - 7})
		.attr("width", 0)
		.attr("height", 8)
		.attr("fill", "#017d75")
		.attr("fill-opacity", .8)
	
	candidate_totals
		.transition()
		.duration(1000)
		//.delay(function(d,i) {  return (parseInt(d.election_period.slice(2,4)) - 6) * 100 })
		.attr("width", function(d) { return fund_scale(d.sum_amount) } )

	
}





function zero_pad(num_string) {
	return num_string.length === 1 ? "0"+num_string : num_string
}


function draw_summary(data, div_id) {
	d3.select(div_id).html("")
	
	fund_scale = d3.scale.linear().domain([0,300000]).range([0,140])
	var sum_svgs = d3.select(div_id) // here is where you can change the containing div
		.selectAll("svg.district_summary")
		.data(data)

	race_summary(sum_svgs)		
	
}



function load_summary_data() {
	query = "https://data.hawaii.gov/resource/jexd-xbcg.json?$select=candidate_name,%20election_period,%20office,%20district,%20count%28*%29,%20sum%28amount%29%20&$where=office=%27House%27 OR office='Senate'&$group=office,%20district,%20election_period,%20candidate_name"

	//assuming winner_data is ready
	$.get(query, function(data) {
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
				if (winner) { winner["winner"] = true; }
			})
			var chamber = district.key.split(" ")[0]
			var d_key = parseInt(district.key.split(" ")[1])+""
			//district.county = precinct_data.filter(function(d) { return d[chamber] === d_key })[0]["County"]
		})
		
		var precinct = getURLParameter("precinct")
		if (precinct !== null && precinct.split("-").length === 2) {
			var precinct_path = d3.select(".P"+ precinct)
			d = precinct_path.data()[0]
			//check_county(d)
			highlight_precinct_from_this(d, ".P"+precinct)
			map_clicked = true;
			var bounds = geo_path.bounds(d)
			zoom_to_bounds(bounds)
		} else {
			draw_summary(summary_data.filter(function(d){if(d.key.match(/^H/g)){return d;}}),"#house_summaries");
        	draw_summary(summary_data.filter(function(d){if(d.key.match(/^S/g)){return true;}}),"#senate_summaries")
		}
	});
}

function load_file_data() {
	var q = queue()
	q.defer(d3.csv, "election_results.csv")
	q.defer(d3.json, "updated_precincts_topo.json")
	q.awaitAll(function(error, results) {
		data = results[0]
		hawaii_geo_json = results[1]

		winner_data = d3.nest()
			.key(function(d) { return d.Title+" "+zero_pad(d.District)+" "+d.Election})
			.sortKeys(d3.ascending)
			.rollup(function(leaves) { return leaves.sort(function(a,b) { return d3.descending(parseInt(a["Total Votes"]), parseInt(b["Total Votes"])) })[0] })
			.map(data);
		
		load_summary_data();
		draw_map();
	})
}

$.get(urls["fundraiser"], function(results) {
	fundraiser_data = results
})
load_file_data();

