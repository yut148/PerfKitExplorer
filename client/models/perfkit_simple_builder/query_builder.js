/**
 * @fileoverview A class that translates a query config model to a set of
 * query properties for producing SQL statements.
 * @author joemu@google.com (Joe Allan Muharsky)
 */

goog.provide('p3rf.dashkit.explorer.models.dashkit_simple_builder.Aggregation');
goog.provide('p3rf.dashkit.explorer.models.dashkit_simple_builder.QueryBuilderService');

goog.require('p3rf.dashkit.explorer.components.query_builder.Filter');
goog.require('p3rf.dashkit.explorer.components.query_builder.FilterClause');
goog.require('p3rf.dashkit.explorer.components.query_builder.QueryBuilder');
goog.require('p3rf.dashkit.explorer.components.query_builder.QueryProperties');
goog.require('p3rf.dashkit.explorer.dateUtil');
goog.require('p3rf.dashkit.explorer.models.dashkit_simple_builder.DateFilter');
goog.require('p3rf.dashkit.explorer.models.dashkit_simple_builder.MetadataFilter');
goog.require('p3rf.dashkit.explorer.models.dashkit_simple_builder.QueryColumnModel');
goog.require('p3rf.dashkit.explorer.models.dashkit_simple_builder.QueryConfigModel');
goog.require('p3rf.dashkit.explorer.models.dashkit_simple_builder.QueryFilterModel');


goog.scope(function() {

var explorer = p3rf.dashkit.explorer;
var DateFilter = explorer.models.dashkit_simple_builder.DateFilter;
var DateFilterType = explorer.models.dashkit_simple_builder.DateFilterType;
var Filter = explorer.components.query_builder.Filter;
var FilterClause = explorer.components.query_builder.FilterClause;
var BigQueryBuilder = explorer.components.query_builder.QueryBuilder;
var QueryProperties = explorer.components.query_builder.QueryProperties;
var dateUtil = explorer.dateUtil;
var MetadataFilter = explorer.models.dashkit_simple_builder.MetadataFilter;
var QueryColumnModel = explorer.models.dashkit_simple_builder.QueryColumnModel;
var QueryConfigModel = explorer.models.dashkit_simple_builder.QueryConfigModel;
var QueryFilterModel = explorer.models.dashkit_simple_builder.QueryFilterModel;


/**
 * Enum for QueryProperties aggregations.  The supported aggregations are
 * either natively supported by big query or explicitly supported by our query
 * builders.  We also supported arbitrary percentile aggregations of the form
 * INTEGER|FLOAT% so '50%' or '.01%'.
 * @enum {string}
 */
explorer.models.dashkit_simple_builder.Aggregation = {
  AVERAGE: 'avg',
  COUNT: 'count',
  LAST: 'last',
  MAX: 'max',
  MEAN: 'mean',
  MIN: 'min',
  STDDEV: 'stddev',
  SUM: 'sum',
  VARIANCE: 'variance'
};
var Aggregation = explorer.models.dashkit_simple_builder.Aggregation;



/**
 * The QueryBuilder service transforms a query model into SQL.
 *
 * @param {!Angular.FilterService} $filter
 * @constructor
 *
 */
explorer.models.dashkit_simple_builder.QueryBuilderService = function(
    $filter) {};
var QueryBuilderService =
    explorer.models.dashkit_simple_builder.QueryBuilderService;


/**
 * Returns a display mode based on the value of a filter.
 * @param {Array.<(string|number|null)>=} opt_values The values to match.
 * @return {Filter.DisplayMode} The display mode to use for the column.
 */
QueryBuilderService.prototype.getColumnDisplayMode = function(opt_values) {
  var visibility = Filter.DisplayMode.COLUMN;
  var value = (
      goog.isDef(opt_values) &&
      !goog.isNull(opt_values) &&
      opt_values.length > 0) ?
      opt_values[0] : null;

  if (goog.isDef(value) && !goog.isNull(value) &&
      !(goog.isString(value) && goog.string.isEmptySafe(value))) {
    visibility = Filter.DisplayMode.HIDDEN;
  }

  return visibility;
};


/**
 * Creates a filter that deals with a single value and clause.  This improves
 * readability of filtering logic, as the UX doesn't presently support multi-
 * values or clauses.  Columns with explicit filters are hidden by default,
 * as they're the same value across the result set.
 * @param {string} fieldName The name of the field to filter on.
 * @param {Array.<(string|number|null)>=} opt_values The list of values to
 *     filter on.
 * @param {?FilterClause.MatchRule=} opt_matchRule The type of matching to
 *     perform.  Defaults to EQ (equals).
 * @param {?Filter.DisplayMode=} opt_displayMode The display mode for the
 *     filter.  Defaults to COLUMN if no value is specified, and HIDDEN if a
 *     value is provided.
 * @param {string=} opt_fieldAlias The alias to use for the field.
 * @return {Filter} A Filter expression.
 */
QueryBuilderService.prototype.createSimpleFilter = function(
    fieldName, opt_values, opt_matchRule, opt_displayMode, opt_fieldAlias) {
  var matchRule = opt_matchRule ? opt_matchRule : FilterClause.MatchRule.EQ;
  var displayMode = opt_displayMode ? opt_displayMode :
      this.getColumnDisplayMode(opt_values);

  var clauses = [];

  if (goog.isDef(opt_values) && !goog.isNull(opt_values)) {
    for (var ctr = 0, len = opt_values.length; ctr < len; ctr++) {
      var value = opt_values[ctr];

      if (!goog.string.isEmptySafe(value)) {
        clauses.push(new FilterClause([value], matchRule));
      }
    }
  }
  var filter = new Filter(fieldName, clauses, displayMode, opt_fieldAlias);
  return filter;
};


/**
 * Returns a date filter clause based on a relative date (last n days, etc.).
 * @param {*} dateFilter A date filter expression.
 * @return {string} A BigQuery function representing the relative date.
 */
QueryBuilderService.prototype.getRelativeDateFunction = function(dateFilter) {
  return ('TIMESTAMP_TO_SEC(DATE_ADD(CURRENT_TIMESTAMP(), -' +
      dateFilter.filter_value + ', "' +
      dateFilter.filter_type + '"))');
};


/**
 * Returns a date filter clause based on a relative date (last n days, etc.).
 * @param {*} dateFilter A date filter expression.
 * @return {string} A BigQuery function representing the relative date.
 */
QueryBuilderService.prototype.getAbsoluteDateFunction = function(dateFilter) {
  return ('TIMESTAMP_TO_SEC(TIMESTAMP(\'' + dateFilter.text + '\'))');
};


/**
 * Returns a SQL statement based on the state of a query.
 * @param {!QueryConfigModel} model a QueryConfigModel that describes a query.
 * @return {string} A formatted SQL statement.
 */
QueryBuilderService.prototype.getSql = function(model) {
  var fieldFilters = [];

  if (model.filters.start_date) {
    var startFilter = null;
    var startDateClause = null;

    switch (model.filters.start_date.filter_type) {
      case DateFilterType.CUSTOM:
        startFilter = this.getAbsoluteDateFunction(model.filters.start_date);

        startDateClause = new FilterClause(
            [startFilter], FilterClause.MatchRule.GE, true);

        break;
      default:
        startDateClause = new FilterClause(
            [this.getRelativeDateFunction(model.filters.start_date)],
            FilterClause.MatchRule.GE, true);

        break;
    }
  }

  if (model.filters.end_date) {
    var endFilter = null;
    var endDateClause = null;

    switch (model.filters.end_date.filter_type) {
      case DateFilterType.CUSTOM:
        endFilter = this.getAbsoluteDateFunction(model.filters.end_date);
        endDateClause = new FilterClause(
            [endFilter], FilterClause.MatchRule.LE, true);

        break;
      default:
        endDateClause = new FilterClause(
            [this.getRelativeDateFunction(model.filters.end_date)],
            FilterClause.MatchRule.LE, true);

        break;
    }
  }

  startDateClause && fieldFilters.push(
      new Filter('timestamp', [startDateClause], Filter.DisplayMode.HIDDEN));

  endDateClause && fieldFilters.push(
      new Filter('timestamp', [endDateClause], Filter.DisplayMode.HIDDEN));

  fieldFilters.push(
      this.createSimpleFilter('product_name', [model.filters.product_name]),
      this.createSimpleFilter('test', [model.filters.test]),
      this.createSimpleFilter('metric', [model.filters.metric]),
      this.createSimpleFilter('owner', [model.filters.runby]));

  var fieldSortOrders = [];

  switch (model.results.date_group) {
    case 'Details':
      fieldFilters.push(this.createSimpleFilter(
          'SEC_TO_TIMESTAMP(INTEGER(timestamp))',
          null, null, null, 'date'));
      break;
    case 'Daily':
      fieldFilters.push(this.createSimpleFilter(
          ('USEC_TO_TIMESTAMP(UTC_USEC_TO_DAY(INTEGER(timestamp * ' +
          dateUtil.BQ_TIMESTAMP_MULTIPLIER + ')))'),
          null, null, null, 'date'));
      break;
    case 'Weekly':
      fieldFilters.push(this.createSimpleFilter(
          ('USEC_TO_TIMESTAMP(UTC_USEC_TO_WEEK(INTEGER(timestamp * ' +
          dateUtil.BQ_TIMESTAMP_MULTIPLIER + '), 0))'),
          null, null, null, 'date'));
      break;
  }

  if (!model.filters.product_name) { fieldSortOrders.push('product_name'); }
  if (!model.filters.test) { fieldSortOrders.push('test'); }
  if (!model.filters.metric) { fieldSortOrders.push('metric'); }
  if (model.results.date_group != 'OneGroup') {
    fieldSortOrders.push('date');
  }

  for (var ctr = 0, len = model.results.labels.length;
       ctr < len; ctr++) {
    var label = model.results.labels[ctr]['label'];
    if (goog.isDef(label) && !goog.string.isEmpty(label)) {
      var field = 'REGEXP_EXTRACT(labels, r\'\\|' + label + ':(.*?)\\|\')';
      fieldFilters.push(this.createSimpleFilter(
          field, null, null, null, label));
    }
  }

  if (model.filters.official == 'true') {
    fieldFilters.push(this.createSimpleFilter('official', [true]));
  } else if (model.filters.official == 'false') {
    fieldFilters.push(this.createSimpleFilter('official', [false]));
  }

  for (var ctr = 0, len = model.filters.metadata.length;
       ctr < len; ctr++) {
    var label = '|' + model.filters.metadata[ctr]['text'] + '|';

    fieldFilters.push(this.createSimpleFilter(
        'labels', [label],
        FilterClause.MatchRule.CT,
        Filter.DisplayMode.HIDDEN));
  }

  var aggregations = [];

  if (model.results.date_group != 'Details') {
    // TODO: Add UX to control which aggregations are performed.
    aggregations = [
      Aggregation.MIN,
      Aggregation.AVERAGE,
      Aggregation.MAX,
      Aggregation.STDDEV,
      Aggregation.VARIANCE,
      Aggregation.COUNT];
  } else {
    fieldFilters.push(this.createSimpleFilter('value'));
    fieldFilters.push(this.createSimpleFilter('log_uri'));
  }

  var queryProperties = new QueryProperties(
      aggregations,
      fieldFilters,
      []);

  var sql = BigQueryBuilder.formatQuery(
      BigQueryBuilder.buildSelectArgs(queryProperties),
      ['samples_mart.results'],
      BigQueryBuilder.buildWhereArgs(queryProperties),
      BigQueryBuilder.buildGroupArgs(queryProperties),
      fieldSortOrders,
      5000);

  return sql;
};


});  // goog.scope
