(function($, task) {
"use strict";

function Events1() { // demo 

	function on_page_loaded(task) {
		
		$("title").text(task.item_caption);
		$("#title").text(task.item_caption);
		 
		if (task.safe_mode) {
			$("#user-info").text(task.user_info.role_name + ' ' + task.user_info.user_name);
			$('#log-out')
			.show() 
			.click(function(e) {
				e.preventDefault();
				task.logout();
			}); 
		}
		
		task.set_forms_container($("#content"));
		if (task.full_width) {
			$('#container').removeClass('container').addClass('container-fluid');
		}
	
		$('#container').show();
		task.create_menu($("#menu"), {view_first: true});
	
		$("#menu-right #admin a").click(function(e) {
			var admin = [location.protocol, '//', location.host, location.pathname, 'builder.html'].join('');
			e.preventDefault();
			window.open(admin, '_blank');
		});
		$("#menu-right #about a").click(function(e) {
			e.preventDefault();
			task.message(
				task.templates.find('.about'),
				{title: 'Jam.py framework', margin: 0, text_center: true, 
					buttons: {"OK": undefined}, center_buttons: true}
			);
		});
	
		// $(document).ajaxStart(function() { $("html").addClass("wait"); });
		// $(document).ajaxStop(function() { $("html").removeClass("wait"); });
	} 
	
	function on_view_form_created(item) {
		var table_height = item.table_options.height, 
			height,
			detail,
			detail_container;
	
		item.clear_filters();
		if (!item.master) {
			item.paginate = true;	
		}
	
		if (item.view_form.hasClass('modal')) {
			item.view_options.width = 1060;
			item.view_form.find("#form-title").hide();
			table_height = $(window).height() - 300;
		}
		else {
			if (!table_height) {
				table_height = $(window).height() - $('body').height() - 20;
			}
		}
		if (item.can_create()) {
			item.view_form.find("#new-btn").on('click.task', function(e) { 
				e.preventDefault();
				if (item.master) {
					item.append_record();
				}
				else {
					item.insert_record();				
				}
			});
		}
		else {
			item.view_form.find("#new-btn").prop("disabled", true);
		}
		
		item.view_form.find("#edit-btn").on('click.task', function(e) { 
			e.preventDefault();
			item.edit_record();
		});
		
		if (item.can_delete()) {
			item.view_form.find("#delete-btn").on('click.task', function(e) { 
				e.preventDefault();
				item.delete_record(); 
			});
		}
		else {
			item.view_form.find("#delete-btn").prop("disabled", true);
		}
		
		if (!item.master && item.owner.on_view_form_created) {
			item.owner.on_view_form_created(item);
		}
	
		if (item.on_view_form_created) {
			item.on_view_form_created(item);
		}
		
		create_print_btns(item);
		
		if (item.view_form.find(".view-table").length) {
			if (item.view_options.view_detail) {
				detail_container = item.view_form.find('.view-detail');
				if (detail_container) {
					height = item.view_options.detail_height;
					if (!height) {
						height = 200;
					}
					item.create_detail_table(detail_container, {height: height});
					table_height -= height;
				}
			}
			if (item.master) {
				table_height = item.master.edit_options.detail_height;
				if (!table_height) {
					table_height = 260;
				}
			}
			if (!item.table_options.height) {
				item.table_options.height = table_height;
			}
			item.create_table(item.view_form.find(".view-table"));
			if (!item.master) {
				item.open(true);
			}
		}
		return true;
	}
	
	function on_view_form_shown(item) {
		item.view_form.find('.dbtable.' + item.item_name + ' .inner-table').focus();
	}
	
	function on_view_form_closed(item) {
		if (!item.master) {
			item.close();
		}
	}
	
	function on_edit_form_created(item) {
		var detail_container = item.edit_form.find(".edit-detail");
	
		item.edit_form.find("#cancel-btn").on('click.task', function(e) { item.cancel_edit(e) });
		item.edit_form.find("#ok-btn").on('click.task', function() { item.apply_record() });
		
		if (!item.master && item.owner.on_edit_form_created) {
			item.owner.on_edit_form_created(item);
		}
	
		if (item.on_edit_form_created) {
			item.on_edit_form_created(item);
		}
			
		if (item.edit_form.find(".edit-body").length) {
			item.create_inputs(item.edit_form.find(".edit-body"));
		}
	
		if (detail_container.length) {
			item.create_detail_views(detail_container);
		}
		return true;
	}
	
	function on_edit_form_close_query(item) {
		var result = true;
		if (item.is_changing()) {
			if (item.is_modified()) {
				item.yes_no_cancel(task.language.save_changes,
					function() {
						item.apply_record();
					},
					function() {
						item.cancel_edit();
					}
				);
				result = false;
			}
			else {
				item.cancel_edit();
			}
		}
		return result;
	}
	
	function on_filter_form_created(item) {
		item.filter_options.title = item.item_caption + ' - filters';
		// item.filter_options.close_focusout = true;
		item.create_filter_inputs(item.filter_form.find(".edit-body"));
		item.filter_form.find("#cancel-btn").on('click.task', function() {
			item.close_filter_form(); 
		});
		item.filter_form.find("#ok-btn").on('click.task', function() { 
			item.set_order_by(item.view_options.default_order);
			item.apply_filters(item._search_params); 
		});
	}
	
	function on_param_form_created(item) {
		item.create_param_inputs(item.param_form.find(".edit-body"));
		item.param_form.find("#cancel-btn").on('click.task', function() { 
			item.close_param_form();
		});
		item.param_form.find("#ok-btn").on('click.task', function() { 
			item.process_report();
		});
	}
	
	function on_before_print_report(report) {
		var select;
		report.extension = 'pdf';
		if (report.param_form) {
			select = report.param_form.find('select');
			if (select && select.val()) {
				report.extension = select.val();
			}
		}
	}
	
	function on_view_form_keyup(item, event) {
		if (event.keyCode === 45 && event.ctrlKey === true){
			if (item.master) {
				item.append_record();
			}
			else {
				item.insert_record();				
			}
		}
		else if (event.keyCode === 46 && event.ctrlKey === true){
			item.delete_record(); 
		}
	}
	
	function on_edit_form_keyup(item, event) {
		if (event.keyCode === 13 && event.ctrlKey === true){
			item.edit_form.find("#ok-btn").focus(); 
			item.apply_record();
		}
	}
	
	function create_print_btns(item) {
		var i,
			$ul,
			$li,
			reports = [];
		if (item.reports) {
			for (i = 0; i < item.reports.length; i++) {
				if (item.reports[i].can_view()) {
					reports.push(item.reports[i]);
				}
			}
			if (reports.length) {
				$ul = item.view_form.find("#report-btn ul");
				for (i = 0; i < reports.length; i++) {
					$li = $('<li><a href="#">' + reports[i].item_caption + '</a></li>');
					$li.find('a').data('report', reports[i]);
					$li.on('click', 'a', function(e) {
						e.preventDefault();
						$(this).data('report').print(false);
					});
					$ul.append($li);
				}
			}
			else {
				item.view_form.find("#report-btn").hide();
			}
		}
		else {
			item.view_form.find("#report-btn").hide();
		}
	}
	this.on_page_loaded = on_page_loaded;
	this.on_view_form_created = on_view_form_created;
	this.on_view_form_shown = on_view_form_shown;
	this.on_view_form_closed = on_view_form_closed;
	this.on_edit_form_created = on_edit_form_created;
	this.on_edit_form_close_query = on_edit_form_close_query;
	this.on_filter_form_created = on_filter_form_created;
	this.on_param_form_created = on_param_form_created;
	this.on_before_print_report = on_before_print_report;
	this.on_view_form_keyup = on_view_form_keyup;
	this.on_edit_form_keyup = on_edit_form_keyup;
	this.create_print_btns = create_print_btns;
}

task.events.events1 = new Events1();

function Events10() { // demo.catalogs.customers 

	function on_view_form_created(item) {
		if (!item.view_form.hasClass('modal')) {	
			item.view_form.find('#email-btn')
				.click(function() {
					if (task.mail.can_create()) {
						task.mail.open({open_empty: true}); 
						task.mail.append_record(); 
					}
					else { 
						item.warning('You are not allowed to send emails.');
					}
				}) 
				.show(); 
			item.view_form.find('#print-btn')
				.click(function() { 
					task.customers_report.customers.value = item.selections;
					task.customers_report.print(false);
				})
				.show();
		}
		
	}
	this.on_view_form_created = on_view_form_created;
}

task.events.events10 = new Events10();

function Events15() { // demo.catalogs.tracks 

	function on_view_form_close_query(item) {
		var copy;
		if (item.invoices) {
			if (item.selections.length > 100) {
				item. warning('Too many records selected. Maximum is 100');
				return false;
			}
			else if (item.selections.length) {
				copy = item.copy();
				copy.set_where({id__in: item.selections});
				copy.open(function() {
					var rec_no = item.invoices.invoice_table.record_count();
					item.invoices.invoice_table.disable_controls();
					try {
						copy.each(function(c){
							if (!item.invoices.invoice_table.locate('track', c.id.value)) {
								item.invoices.invoice_table.append();
								item.invoices.invoice_table.track.value = c.id.value;
								item.invoices.invoice_table.track.lookup_value = c.name.value;
								item.invoices.invoice_table.album.lookup_value = c.album.display_text;
								item.invoices.invoice_table.artist.lookup_value = c.artist.display_text;
								item.invoices.invoice_table.unitprice.value = c.unitprice.value;
								item.invoices.invoice_table.quantity.value = 1;
								item.invoices.invoice_table.post();
							}
						});
					}
					finally {
						item.invoices.invoice_table.rec_no = rec_no;
						item.invoices.invoice_table.enable_controls();
						item.invoices.invoice_table.update_controls();
					}
				});
			}
		}
	}
	this.on_view_form_close_query = on_view_form_close_query;
}

task.events.events15 = new Events15();

function Events16() { // demo.journals.invoices 

	function on_after_append(item) {
		item.date.value = new Date(); 
		item.taxrate.value = 5;
	}
	
	function on_view_form_created(item) {
		item.filters.invoicedate1.value = new Date(new Date().setYear(new Date().getFullYear() - 1));
	}
	
	function on_edit_form_created(item) {
		item.edit_form.find("#select-btn").click(function(e) { 
			var tracks = task.tracks.copy();
			tracks.invoices = item;
			tracks.table_options.multiselect = true;
			tracks.view();
		});
	}
	
	function on_field_get_text(field) {
		if (field.field_name === 'customer' && field.value) {
			return field.owner.firstname.lookup_text + ' ' + field.lookup_text;
		}
	}
	
	function on_field_changed(field, lookup_item) {
		var item = field.owner;
		if (field.field_name === 'taxrate') {
			item.invoice_table.each(function(t) {
				t.edit();
				t.calc(t);
				t.post();
			});
			item.invoice_table.first();
		}
	}
	
	function on_detail_changed(item, detail) {
		var fields = [
			{"total": "total"}, 
			{"tax": "tax"}, 
			{"subtotal": "amount"}
		];  
		item.calc_summary(detail, fields);
	}
	this.on_after_append = on_after_append;
	this.on_view_form_created = on_view_form_created;
	this.on_edit_form_created = on_edit_form_created;
	this.on_field_get_text = on_field_get_text;
	this.on_field_changed = on_field_changed;
	this.on_detail_changed = on_detail_changed;
}

task.events.events16 = new Events16();

function Events18() { // demo.journals.invoices.invoice_table 

	function calc(item) {
		item.amount.value = item.round(item.quantity.value * item.unitprice.value, 2);
		item.tax.value = item.round(item.amount.value * item.owner.taxrate.value / 100, 2);
		item.total.value = item.amount.value + item.tax.value;
	}
	
	function on_field_changed(field, lookup_item) {
		var item = field.owner;
		if (field.field_name === 'track' && lookup_item) {
			item.quantity.value = 1;
			item.unitprice.value = lookup_item.unitprice.value;
		}
		else if (field.field_name === 'quantity' || field.field_name === 'unitprice') {
			calc(item);
		}
	}
	this.calc = calc;
	this.on_field_changed = on_field_changed;
}

task.events.events18 = new Events18();

function Events19() { // demo.reports.invoice 

	function on_before_print_report(report) {
		report.id.value = report.task.invoices.id.value;
	}
	this.on_before_print_report = on_before_print_report;
}

task.events.events19 = new Events19();

function Events20() { // demo.reports.purchases_report 

	function on_param_form_created( report ) {
		var now = new Date();
		if (!report.invoicedate1.value) {
			report.invoicedate1.value = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
			report.invoicedate2.value = now;
		}
	}
	this.on_param_form_created = on_param_form_created;
}

task.events.events20 = new Events20();

function Events24() { // demo.analytics.dashboard 

	function on_view_form_created(item) {
		show_cusomers(item, item.view_form.find('#cutomers-canvas').get(0).getContext('2d'));
		show_tracks(item, item.view_form.find('#tracks-canvas').get(0).getContext('2d'));
	}
	
	function show_cusomers(item, ctx) {
		var inv = item.task.invoices.copy({handlers: false});
		inv.open(
			{
				fields: ['customer', 'total'], 
				funcs: {total: 'sum'},
				group_by: ['customer'],
				order_by: ['-total'],
				limit: 10
			}, 
			function() {
				var labels = [],
					data = [],
					colors = [];
				inv.each(function(i) {
					labels.push(i.customer.display_text);
					data.push(i.total.value.toFixed(2));
					colors.push(lighten('#006bb3', (i.rec_no - 1) / 10));
				});
				inv.first();
				draw_chart(item, ctx, labels, data, colors, 'Ten most active customers');
				inv.create_table(item.view_form.find('#customer-table'), 
					{row_count: 10, dblclick_edit: false});						
			}
		);
		return inv;
	}
	
	function show_tracks(item, ctx) {
		var tracks = item.task.tracks.copy({handlers: false});
		tracks.open(
			{
				fields: ['name', 'tracks_sold'], 
				order_by: ['-tracks_sold'],
				limit: 10
			}, 
			
			function() {
				var labels = [],
					data = [],
					colors = [];
				tracks.each(function(t) {
					labels.push(t.name.display_text);
					data.push(t.tracks_sold.value);
					colors.push(lighten('#196619', (t.rec_no - 1) / 10));
				});
				tracks.first();
				tracks.name.field_caption = 'Track';
				draw_chart(item, ctx, labels, data, colors, 'Ten most popular tracks');
				tracks.create_table(item.view_form.find('#tracks-table'), 
					{row_count: 10, dblclick_edit: false});
			}
		);
		return tracks;
	}
	
	function draw_chart(item, ctx, labels, data, colors, title) {
		new Chart(ctx,{
			type: 'pie',
			data: {
				labels: labels,
				datasets: [
					{
						data: data,
						backgroundColor: colors
					}
				]					
			},
			options: {
				 title: {
					display: true,
					fontsize: 14,
					text: title
				},
				legend: {
					position: 'bottom',
				},
			}
		});
	}
	
	function lighten(color, luminosity) {
		color = color.replace(/[^0-9a-f]/gi, '');
		if (color.length < 6) {
			color = color[0]+ color[0]+ color[1]+ color[1]+ color[2]+ color[2];
		}
		luminosity = luminosity || 0;
		var newColor = "#", c, i, black = 0, white = 255;
		for (i = 0; i < 3; i++) {
			c = parseInt(color.substr(i*2,2), 16);
			c = Math.round(Math.min(Math.max(black, c + (luminosity * white)), white)).toString(16);
			newColor += ("00"+c).substr(c.length);
		}
		return newColor; 
	}
	this.on_view_form_created = on_view_form_created;
	this.show_cusomers = show_cusomers;
	this.show_tracks = show_tracks;
	this.draw_chart = draw_chart;
	this.lighten = lighten;
}

task.events.events24 = new Events24();

function Events25() { // demo.catalogs.mail 

	function on_edit_form_created(item) {
		var title = 'Email to ';
		if (task.customers.selections && task.customers.selections.length)
			title += task.customers.selections.length + ' selected customers';
		else {
			title += task.customers.firstname.value + ' ' +
				task.customers.lastname.value;
		}
		item.edit_options.title = title;
		item.edit_form.find('#ok-btn')
			.text('Send email')
			.off('click.task')
			.on('click', function() {
				send_email(item);
			});
		item.edit_form.find('textarea.mess').height(120);
	}
	
	function send_email(item) {
		var customers = task.customers.selections;
		try {
			item.post();
			if (!customers.length) {
				customers.add(task.customers.id.value);
			}
			item.server('send_email', [customers, item.subject.value, item.mess.value], 
				function(result, err) {
					if (err) {
						item.warning('Failed to send the mail: ' + err);
						item.edit();
					}
					else {
						item.warning('Successfully sent the mail');
						item.close_edit_form();
						item.delete();			
					}
				}
			);
		}
		catch (e) {}
	}
	this.on_edit_form_created = on_edit_form_created;
	this.send_email = send_email;
}

task.events.events25 = new Events25();

})(jQuery, task)