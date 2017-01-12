#pragma once


#ifndef HMODEL_
#define HMODEL_

#include "model.h"

class hierarchical_model : public model {

	int L; // level of topics
	double eta;
	double *** heta;  //multilnomial probabilities between topic layers for Hierarchical model size = sum(Ki * K(i+1))
	//where Ki is the topic number of i th level, i=1 to n-1, n is the hierachical level depth
	double ** theta; // theta: document-topic distributions for top level, size M x K1
	double ** phi; // phi: topic-word distributions for bottom sub level, size K(n-1) x V

	int * _Ks;//K topic number for each layer

	int init_est_hierarchical();
	void set_default_values();
	void estimate();
	void remove_word(int m, int n);
	void resample_word(int m, int n, int topic);

	int sample(int m, int n);
	
	~hierarchical_model();

};

#endif // !HMODEL_
