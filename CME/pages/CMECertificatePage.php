<?php

/**
 * Page for generating and viewing certificates.
 *
 * @copyright 2011-2016 silverorange
 * @license   http://www.opensource.org/licenses/mit-license.html MIT License
 */
abstract class CMECertificatePage extends SiteUiPage
{
    /**
     * @var array
     *
     * Formatted:
     * array(
     * 		$front_matter_id => array(
     *	 		'front_matter' => CMEFrontMatter,
     *			'credits' => CMEAccountEarnedCMECreditWrapper,
     *		)
     *	) …
     */
    protected $credits_by_front_matter;

    /**
     * @var bool
     */
    protected $has_pre_selection = false;

    protected function getUiXml()
    {
        return __DIR__ . '/cme-certificate.xml';
    }

    // init phase

    public function init()
    {
        if (!$this->app->session->isLoggedIn()) {
            $uri = sprintf(
                '%s?relocate=%s',
                $this->app->config->uri->account_login,
                $this->source
            );

            $this->app->relocate($uri);
        }
        $account = $this->app->session->account;

        $key = 'cme-hours-' . $account->id;

        $hours = $this->app->getCacheValue($key, 'cme-hours');
        if ($hours === false) {
            $hours = $account->getEarnedCMECreditHours();
            $this->app->addCacheValue($hours, $key, 'cme-hours');
        }

        // If no hours are earned and no CME access is available, go to account
        // details. Not using strict equality because $hours can be a float
        // value.
        if (!$account->hasCMEAccess() && $hours == 0) {
            $this->app->relocate('account');
        }

        parent::init();
    }

    protected function initInternal()
    {
        parent::initInternal();
        $this->initCredits();
        $this->initList();
    }

    protected function initCredits()
    {
        $account = $this->app->session->account;
        $this->credits_by_front_matter = [];

        $wrapper_class = SwatDBClassMap::get(CMEAccountEarnedCMECreditWrapper::class);

        foreach ($account->earned_cme_credits as $credit) {
            $front_matter = $credit->credit->front_matter;
            if (!isset($this->credits_by_front_matter[$front_matter->id])) {
                $wrapper = new $wrapper_class();
                $wrapper->setDatabase(
                    $this->app->db
                );

                $this->credits_by_front_matter[$front_matter->id] = [
                    'front_matter' => $front_matter,
                    'credits'      => new $wrapper(),
                ];
            }

            $this->credits_by_front_matter[$front_matter->id]['credits']->add(
                $credit
            );
        }
    }

    protected function getEpisodeIds()
    {
        $episode_ids = [];
        $selected_front_matter_ids =
            $this->ui->getWidget('front_matters')->values;

        foreach ($this->credits_by_front_matter as $id => $array) {
            $front_matter = $array['front_matter'];
            if (in_array($id, $selected_front_matter_ids)) {
                $episode_ids[] = $front_matter->episode->id;
            }
        }

        return $episode_ids;
    }

    protected function initList()
    {
        $values = [];
        $list = $this->ui->getWidget('front_matters');

        foreach ($this->credits_by_front_matter as $array) {
            $front_matter = $array['front_matter'];

            $list->addOption(
                $this->getListOption($front_matter),
                $this->getListOptionMetaData($front_matter)
            );

            if ($this->isPreSelected($front_matter)) {
                $this->has_pre_selection = true;
                $values[] = $front_matter->id;
            }
        }

        $list->values = $values;
    }

    protected function getListOption(CMEFrontMatter $front_matter)
    {
        return new SwatOption(
            $front_matter->id,
            $this->getListOptionTitle($front_matter),
            'text/xml'
        );
    }

    protected function getListOptionMetaData(CMEFrontMatter $front_matter)
    {
        return [];
    }

    protected function getListOptionTitle(CMEFrontMatter $front_matter)
    {
        $account = $this->app->session->account;
        $hours = $account->getEarnedCMECreditHoursByFrontMatter($front_matter);
        $locale = SwatI18NLocale::get();

        ob_start();

        $this->displayTitle($front_matter);

        $field = (abs($hours - 1.0) < 0.01)
            ? 'credit_title'
            : 'credit_title_plural';

        $titles = [];
        foreach ($front_matter->providers as $provider) {
            $em_tag = new SwatHtmlTag('em');
            $em_tag->setContent($provider->{$field});
            $titles[] = $em_tag->__toString();
        }
        $formatted_provider_credit_title = SwatString::toList($titles);

        $hours_span = new SwatHtmlTag('span');
        $hours_span->class = 'hours';
        $hours_span->setContent(
            sprintf(
                CME::_('%s %s from %s'),
                SwatString::minimizeEntities($locale->formatNumber($hours)),
                $formatted_provider_credit_title,
                SwatString::minimizeEntities(
                    $front_matter->getProviderTitleList()
                )
            ),
            'text/xml'
        );
        $hours_span->display();

        $details = $this->getFrontMatterDetails($front_matter);
        if ($details != '') {
            $details_span = new SwatHtmlTag('span');
            $details_span->class = 'details';
            $details_span->setContent($details);
            $details_span->display();
        }

        return ob_get_clean();
    }

    protected function displayTitle(CMEFrontMatter $front_matter)
    {
        $title_span = new SwatHtmlTag('span');
        $title_span->class = 'title';
        $title_span->setContent($this->getFrontMatterTitle($front_matter));
        $title_span->display();
    }

    abstract protected function getFrontMatterTitle(
        CMEFrontMatter $credit
    );

    protected function getFrontMatterDetails(CMEFrontMatter $front_matter)
    {
        return '';
    }

    protected function isPreSelected(CMEFrontMatter $front_matter)
    {
        $selected = SiteApplication::initVar(
            'selected',
            null,
            SiteApplication::VAR_GET
        );

        return is_array($selected) && in_array($front_matter->id, $selected);
    }

    // process phase

    protected function processInternal()
    {
        $front_matter_ids = $this->ui->getWidget('front_matters')->values;

        $wrapper = SwatDBClassMap::get(CMEAccountEarnedCMECreditWrapper::class);

        $form = $this->ui->getWidget('certificate_form');
        if ($form->isProcessed() && count($front_matter_ids) === 0) {
            $this->ui->getWidget('message_display')->add(
                new SwatMessage(
                    CME::_('No credits were selected to print.')
                ),
                SwatMessageDisplay::DISMISS_OFF
            );
        }
    }

    protected function isProcessed()
    {
        $form = $this->ui->getWidget('certificate_form');

        return $this->has_pre_selection || $form->isProcessed();
    }

    // build phase

    protected function buildInternal()
    {
        parent::buildInternal();

        $form = $this->ui->getWidget('certificate_form');
        $form->action = $this->getSource();

        if ($this->isProcessed()) {
            $this->buildCertificates();
            ob_start();
            Swat::displayInlineJavaScript($this->getInlineJavaScript());
            $this->ui->getWidget('certificate')->content = ob_get_clean();
        }
    }

    protected function buildContent()
    {
        $content = $this->layout->data->content;
        $this->layout->data->content = '';

        $this->ui->getWidget('article_bodytext')->content = $content;
        $this->ui->getWidget('article_bodytext')->content_type = 'text/xml';

        parent::buildContent();
    }

    protected function buildTitle()
    {
        parent::buildTitle();
        $this->layout->data->title = CME::_('Print CME Certificates');
    }

    abstract protected function buildCertificates();

    protected function getInlineJavaScript()
    {
        $episode_array = json_encode($this->getEpisodeIds());

        return <<<JAVASCRIPT
            		YAHOO.util.Event.on(window, 'load', function() {

            			if (typeof amplitude !== 'undefined') {
            				amplitude.track('CME_Printed', {
            					episode_ids: {$episode_array},
            				});
            			}

            			var certificates = YAHOO.util.Dom.getElementsByClassName(
            				'cme-certificate',
            				'div'
            			);

            			if (certificates.length > 0) {
            				window.print();
            			}
            		});
            JAVASCRIPT;
    }

    // finalize phase

    public function finalize()
    {
        parent::finalize();

        $this->layout->addBodyClass('cme-certificate-page');

        $yui = new SwatYUI(['dom', 'event']);
        $this->layout->addHtmlHeadEntrySet($yui->getHtmlHeadEntrySet());

        $this->layout->addHtmlHeadEntry(
            'packages/cme/javascript/cme-certificate-page.js'
        );
    }
}
