<?php

/**
 * @package   CME
 * @copyright 2011-2016 silverorange
 * @license   http://www.opensource.org/licenses/mit-license.html MIT License
 */
class CMEQuizReportIndex extends AdminIndex
{


	/**
	 * @var array
	 */
	protected $reports_by_quarter = array();

	/**
	 * @var CMEProviderWrapper
	 */
	protected $providers;

	/**
	 * @var SwatDate
	 */
	protected $start_date;




	protected function getUiXml()
	{
		return __DIR__.'/index.xml';
	}



	// init phase


	protected function initInternal()
	{
		parent::initInternal();
		$this->ui->loadFromXML($this->getUiXml());
		$this->initStartDate();
		$this->initProviders();
		$this->initReportsByQuarter();
		$this->initTableViewColumns();
	}




	protected function initStartDate()
	{
		$oldest_date_string = SwatDB::queryOne(
			$this->app->db,
			'select min(complete_date) from InquisitionResponse
			where complete_date is not null
				and reset_date is null
				and inquisition in (select quiz from AccountCMEProgress)'
		);

		$this->start_date = new SwatDate($oldest_date_string);
		$this->start_date->setTimezone($this->app->default_time_zone);
	}




	protected function initProviders()
	{
		$this->providers = SwatDB::query(
			$this->app->db,
			'select * from CMEProvider order by title, id',
			SwatDBClassMap::get('CMEProviderWrapper')
		);
	}




	protected function initReportsByQuarter()
	{
		$sql = 'select * from QuizReport order by quarter';
		$reports = SwatDB::query(
			$this->app->db,
			$sql,
			SwatDBClassMap::get('CMEQuizReportWrapper')
		);

		$reports->attachSubDataObjects(
			'provider',
			$this->providers
		);

		foreach ($reports as $report) {
			$quarter = clone $report->quarter;
			$quarter->setTimezone($this->app->default_time_zone);
			$quarter = $quarter->formatLikeIntl('yyyy-qq');
			$provider = $report->provider->shortname;
			if (!isset($this->reports_by_quarter[$quarter])) {
				$this->reports_by_quarter[$quarter] = array();
			}
			$this->reports_by_quarter[$quarter][$provider] = $report;
		}
	}




	protected function initTableViewColumns()
	{
		$view = $this->ui->getWidget('index_view');
		foreach ($this->providers as $provider) {
			$renderer = new AdminTitleLinkCellRenderer();
			$renderer->link = sprintf(
				'QuizReport/Download?type=%s&quarter=%%s',
				$provider->shortname
			);
			$renderer->stock_id = 'download';
			$renderer->text = $provider->title;

			$column = new SwatTableViewColumn();
			$column->id = 'provider_'.$provider->shortname;
			$column->addRenderer($renderer);
			$column->addMappingToRenderer(
				$renderer,
				'quarter',
				'link_value'
			);

			$column->addMappingToRenderer(
				$renderer,
				'is_'.$provider->shortname.'_sensitive',
				'sensitive'
			);

			$view->appendColumn($column);
		}
	}



	// build phase


	protected function getTableModel(SwatView $view): ?SwatTableModel
	{
		$now = new SwatDate();
		$now->setTimezone($this->app->default_time_zone);

		$year = $this->start_date->getYear();

		$start_date = new SwatDate();
		$start_date->setTime(0, 0, 0);
		$start_date->setDate($year, 1, 1);
		$start_date->setTZ($this->app->default_time_zone);

		$end_date = clone $start_date;
		$end_date->addMonths(3);

		$display_end_date = clone $end_date;
		$display_end_date->subtractMonths(1);

		$quarters = [];

		while ($end_date->before($now)) {
			for ($i = 1; $i <= 4; $i++) {
				// Only add the quarter to the table model if the start date
				// is within or prior to that quarter.
				if ($this->start_date->before($end_date)) {

					$ds = new SwatDetailsStore();

					$quarter = $start_date->formatLikeIntl('yyyy-qq');

					$ds->date    = clone $start_date;
					$ds->year    = $year;
					$ds->quarter = $quarter;

					$ds->quarter_title = sprintf(
						CME::_('Q%s - %s to %s'),
						$i,
						$start_date->formatLikeIntl('MMMM yyyy'),
						$display_end_date->formatLikeIntl('MMMM yyyy')
					);

					foreach ($this->providers as $provider) {
						$shortname = $provider->shortname;
						$sensitive = isset(
							$this->reports_by_quarter[$quarter][$shortname]
						);

						$ds->{'is_'.$shortname.'_sensitive'} = $sensitive;
					}

					// reverse the order so we can display newest to oldest
					array_unshift($quarters, $ds);
				}

				$start_date->addMonths(3);
				$end_date->addMonths(3);
				$display_end_date->addMonths(3);
			}

			$year++;
		}

		// display the quarters in reversed order
		$store = new SwatTableStore();
		foreach($quarters as $ds) {
			$store->add($ds);
		}
		return $store;
	}


}

?>
