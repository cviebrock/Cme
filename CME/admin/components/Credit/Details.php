<?php

/**
 * @package   CME
 * @copyright 2014-2016 silverorange
 */
class CMECreditDetails extends InquisitionInquisitionDetails
{


	/**
	 * @var CMECredit
	 */
	protected $credit;




	protected function getCreditDetailsViewXml()
	{
		return __DIR__.'/details-credit-fields.xml';
	}



	// init phase


	protected function initInternal()
	{
		AdminIndex::initInternal();

		$this->id = SiteApplication::initVar('id');

		if (is_numeric($this->id)) {
			$this->id = intval($this->id);
		}

		$this->initCredit();
		$this->initInquisition();

		$this->ui->loadFromXML($this->getUiXml());

		$local_ui = new SwatUI();
		$local_ui->loadFromXML($this->getCreditDetailsViewXml());

		$provider_titles = array();
		foreach ($this->credit->front_matter->providers as $provider) {
			$provider_titles[] = $provider->credit_title_plural;
		}

		$local_ui->getWidget('details_view')->getField('hour')->title =
			SwatString::toList($provider_titles);

		$view = $this->ui->getWidget('details_view');
		foreach ($local_ui->getWidget('details_view')->getFields() as $field) {
			$view->appendField($field);
		}
	}




	protected function initInquisition()
	{
		$this->inquisition = $this->credit->quiz;

		$bindings = $this->inquisition->question_bindings;

		// efficiently load questions
		$questions = $bindings->loadAllSubDataObjects(
			'question',
			$this->app->db,
			'select * from InquisitionQuestion where id in (%s)',
			SwatDBClassMap::get('InquisitionQuestionWrapper')
		);

		// efficiently load question options
		if ($questions instanceof InquisitionQuestionWrapper) {
			$questions->loadAllSubRecordsets(
				'options',
				SwatDBClassMap::get('InquisitionQuestionOptionWrapper'),
				'InquisitionQuestionOption',
				'question',
				'',
				'displayorder, id'
			);
		}
	}




	protected function initCredit()
	{
		$class_name = SwatDBClassMap::get('CMECredit');
		$this->credit = new $class_name();
		$this->credit->setDatabase($this->app->db);

		if (!$this->credit->load($this->id)) {
			throw new AdminNotFoundException(
				sprintf(
					'A CME credit with the id of ‘%s’ does not exist.',
					$this->id
				)
			);
		}
	}



	// build phase


	protected function buildInternal()
	{
		parent::buildInternal();

		$this->ui->getWidget('details_frame')->title =
			$this->credit->getTitle();

		$view = $this->ui->getWidget('details_view');
		$view->getField('title')->visible = false;
		$view->getField('createdate')->visible = false;

		// set default time zone
		$expiry_date_field = $view->getField('expiry_date');
		$expiry_date_renderer = $expiry_date_field->getFirstRenderer();
		$expiry_date_renderer->display_time_zone =
			$this->app->default_time_zone;
	}




	protected function buildToolbars()
	{
		parent::buildToolbars();

		$this->ui->getWidget('edit_link')->link = sprintf(
			'Credit/Edit?id=%s',
			$this->credit->id
		);

		$this->ui->getWidget('delete_link')->link = sprintf(
			'Credit/Delete?id=%s',
			$this->credit->id
		);
	}




	protected function buildNavBar()
	{
		parent::buildNavBar();

		$this->navbar->popEntry();
		$this->navbar->createEntry($this->credit->getTitle());
	}




	protected function getDetailsStore(InquisitionInquisition $inquisition)
	{
		$ds = parent::getDetailsStore($inquisition);
		$ds->hours = $this->credit->hours;
		$ds->expiry_date = $this->credit->expiry_date;
		return $ds;
	}


}

?>
