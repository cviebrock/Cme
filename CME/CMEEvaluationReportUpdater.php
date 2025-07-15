<?php

/**
 * @copyright 2011-2016 silverorange
 * @license   http://www.opensource.org/licenses/mit-license.html MIT License
 */
abstract class CMEEvaluationReportUpdater extends CMEReportUpdater
{
    protected function getStatusLine()
    {
        return CME::_("Generating Quarterly Evaluation Reports\n\n");
    }

    protected function getReports()
    {
        return SwatDB::query(
            $this->db,
            'select * from EvaluationReport order by quarter',
            SwatDBClassMap::get(CMEEvaluationReportWrapper::class)
        );
    }

    protected function getReportClassName()
    {
        return SwatDBClassMap::get(CMEEvaluationReport::class);
    }

    protected function getReportGenerator(
        CMEProvider $provider,
        $year,
        $quarter
    ) {
        $generator_class_name = $this->getReportGeneratorClassName();

        return new $generator_class_name(
            $this,
            $provider,
            $year,
            $quarter
        );
    }

    protected function getReportGeneratorClassName()
    {
        return CMEEvaluationReportGenerator::class;
    }
}
