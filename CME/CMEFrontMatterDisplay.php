<?php

/**
 * @copyright 2011-2016 silverorange
 * @license   http://www.opensource.org/licenses/mit-license.html MIT License
 */
class CMEFrontMatterDisplay extends SwatControl
{
    /**
     * @var string
     */
    public $content;

    /**
     * @var string
     */
    public $title;

    /**
     * @var string
     */
    public $server;

    /**
     * @var string
     */
    public $cancel_uri;

    public function __construct($id = null)
    {
        parent::__construct($id);

        $yui = new SwatYUI(
            [
                'dom',
                'event',
                'animation',
                'connection',
                'container_core',
            ]
        );
        $this->html_head_entry_set->addEntrySet($yui->getHtmlHeadEntrySet());

        $this->addJavaScript(
            'packages/swat/javascript/swat-z-index-manager.js'
        );
        $this->addJavaScript(
            'packages/site/javascript/site-dialog.js'
        );
        $this->addJavaScript(
            'packages/cme/javascript/cme-front-matter-display.js'
        );
    }

    public function display()
    {
        if (!$this->visible) {
            return;
        }

        parent::display();

        Swat::displayInlineJavaScript($this->getInlineJavaScript());
    }

    protected function getCSSClassNames()
    {
        return array_merge(
            ['cme-front-matter-display'],
            parent::getCSSClassNames()
        );
    }

    protected function getInlineJavaScript()
    {
        static $shown = false;

        if (!$shown) {
            $javascript = $this->getInlineJavaScriptTranslations();
            $shown = true;
        } else {
            $javascript = '';
        }

        $javascript .= sprintf(
            '%s_obj = new %s(%s, %s, %s, %s, %s, %s);',
            $this->id,
            $this->getJavaScriptClassName(),
            SwatString::quoteJavaScriptString($this->id),
            SwatString::quoteJavaScriptString($this->getCSSClassString()),
            SwatString::quoteJavaScriptString($this->server),
            SwatString::quoteJavaScriptString($this->title),
            SwatString::quoteJavaScriptString($this->content),
            SwatString::quoteJavaScriptString($this->cancel_uri)
        );

        return $javascript;
    }

    protected function getInlineJavaScriptTranslations()
    {
        $accept_text = CME::_('I Have Read the CME Information / Continue');
        $cancel_text = CME::_('Cancel and Return');
        $confirm_text = CME::_(
            'Before you view %s, please attest to reading the following:'
        );

        return sprintf(
            "CMEFrontMatterDisplay.accept_text = %s;\n" .
            "CMEFrontMatterDisplay.cancel_text = %s;\n" .
            "CMEFrontMatterDisplay.confirm_text = %s;\n",
            SwatString::quoteJavaScriptString($accept_text),
            SwatString::quoteJavaScriptString($cancel_text),
            SwatString::quoteJavaScriptString($confirm_text)
        );
    }

    protected function getJavaScriptClassName()
    {
        return 'CMEFrontMatterDisplay';
    }
}
